import { getCatalog } from "@sistema/shared/db";
import { isOpenNow, parseOrderCode } from "@sistema/shared";

import type { Conversation, Message } from "@/db/queries/conversation";
import {
  countRecentCustomerMessages,
  getMessages,
  recordMessage,
  setBotPaused,
  upsertConversationOnInbound,
} from "@/db/queries/conversation";
import { findOrderByCode } from "@/db/queries/orders";
import { env } from "@/env";
import {
  sendCta,
  sendButtons,
  sendImage,
  sendText,
  type SendResult,
} from "@/services/whatsapp/client";
import type { IncomingMessage } from "@/services/whatsapp/types";

import { runAdvisor } from "./advisor";
import { handleOrderTurn, startOrder } from "./engine";
import {
  isBusinessInfoRequest,
  isGreeting,
  isHelpRequest,
  isHowToOrderRequest,
  isHumanRequest,
  isMenuRequest,
  isResumeRequest,
} from "./intent";
import { buildMenuUrl, menuButtonLabel, type MenuTarget } from "./menu-link";
import { BUTTONS, MESSAGES } from "./messages";
import { inboxMeta, type BotReply } from "./types";

/**
 * El orquestador del asistente (RF-11 a RF-19).
 *
 * Es el único punto que decide qué le llega al cliente en respuesta a un
 * mensaje entrante: registra el turno, elige la puerta que lo atiende, y
 * manda la respuesta por el único camino de salida (RN-05).
 *
 * El orden de las puertas **no es arbitrario** — va de lo más específico y
 * barato a lo más vago y caro, y las rutas deterministas se resuelven antes de
 * gastar una llamada al modelo (ADR-09):
 *
 *  1. "reiniciar" — el respaldo para retomar el bot, funciona incluso pausado.
 *  2. ¿El bot está pausado? Silencio total (RN-04).
 *  3. ¿Fuera de horario? El horario, sin llamar al modelo ni seguir el pedido
 *     en curso — un negocio cerrado no toma pedidos nuevos ni sigue los
 *     viejos hasta que abre.
 *  4. Tope de mensajes por hora (RF-18).
 *  5. Audio o imagen: la transcripción y la lectura de comprobantes necesitan
 *     además descargar el adjunto de Meta (Fase 2 en vivo), así que por ahora
 *     degradan con gracia incluso teniendo `OPENAI_API_KEY`.
 *  6. ¿Hay un pedido en curso? Lo atiende el motor, no el modelo.
 *  7. ¿Trae un código `#PEDIDO`? Se canjea (RF-27, el respaldo manual).
 *  8. Botones y frases de ayuda / escalar a una persona.
 *  9. Rutas fijas: cómo pedir, menú, datos del negocio.
 *  10. Saludo, solo en el primer contacto.
 *  11. Todo lo demás: el asesor con el modelo (`bot/advisor.ts`, RF-13). Si
 *      `OPENAI_API_KEY` falta o la llamada falla, degrada con el mensaje fijo
 *      de RF-17 — es el mismo camino, no una rama aparte.
 */
export async function handleIncoming(message: IncomingMessage) {
  const conversation = await upsertConversationOnInbound(
    message.phone,
    message.profileName,
  );

  const input = toRouteInput(message);
  await recordMessage(conversation.id, "customer", input.storeKind, input.text, {
    waMessageId: message.waMessageId,
    meta: input.storeMeta,
  });

  const reply = await route(conversation, input);

  if (reply) {
    await recordMessage(conversation.id, "bot", "text", reply.text, {
      meta: inboxMeta(reply),
    });

    if (reply.escalated) {
      await setBotPaused(conversation.id, true, reply.escalated.reason);
    }

    const result = await deliverReply(message.phone, reply);
    if (!result.ok) {
      console.warn("[orchestrator] no se pudo entregar la respuesta:", result);
    }
  }

  return { conversation, reply };
}

// --- Normalización del mensaje a lo que la ruta necesita --------------------

type RouteKind = "text" | "button" | "audio" | "image" | "unsupported";

type RouteInput = {
  kind: RouteKind;
  text: string;
  buttonId?: string;
  storeKind: "text" | "button" | "audio" | "image" | "system";
  storeMeta?: Record<string, unknown>;
};

/**
 * Convierte el mensaje normalizado del canal en lo que la ruta necesita para
 * decidir.
 *
 * **Audio e imagen no se procesan todavía** (transcripción y lectura de
 * comprobantes exigen `OPENAI_API_KEY`, que no está configurado en esta
 * fase). Se guardan igual en el hilo —con su `mediaId`, para no perder el
 * dato— y la ruta responde con el mensaje de degradación correspondiente
 * (RF-17 aplicado también a estos dos casos, no solo a las preguntas libres).
 */
function toRouteInput(message: IncomingMessage): RouteInput {
  switch (message.kind) {
    case "text":
      return { kind: "text", text: message.text, storeKind: "text" };
    case "button":
      return {
        kind: "button",
        text: message.title,
        buttonId: message.buttonId,
        storeKind: "button",
        storeMeta: { buttonId: message.buttonId },
      };
    case "audio":
      return {
        kind: "audio",
        text: "",
        storeKind: "audio",
        storeMeta: { mediaId: message.mediaId, mimeType: message.mimeType },
      };
    case "image":
      return {
        kind: "image",
        text: message.caption ?? "",
        storeKind: "image",
        storeMeta: { mediaId: message.mediaId, mimeType: message.mimeType },
      };
    case "unsupported":
      return {
        kind: "unsupported",
        text: "",
        storeKind: "system",
        storeMeta: { type: message.type },
      };
  }
}

// --- El enrutador ------------------------------------------------------------

async function route(
  conversation: Conversation,
  input: RouteInput,
): Promise<BotReply | null> {
  const menu = (target?: MenuTarget) => ({
    url: buildMenuUrl(conversation.phone, target),
    label: menuButtonLabel(target ?? { kind: "catalog" }),
  });

  // 1. El respaldo de siempre (RF-19). Funciona incluso con el bot pausado —
  //    es justo para eso. Si NO está pausado no hace nada: no hay nada que
  //    "reiniciar".
  if (input.kind === "text" && isResumeRequest(input.text)) {
    if (!conversation.botPaused) return null;
    await setBotPaused(conversation.id, false);
    return { text: MESSAGES.botResumed() };
  }

  // 2. Bot pausado: silencio total en ESTA conversación (RN-04). La persona
  //    que tomó el chat no puede tener al bot contestando encima.
  if (conversation.botPaused) return null;

  // 3. Fuera de horario (RF-12). Corte duro, antes que cualquier otra cosa
  //    —incluido un pedido a medio cerrar—: un negocio cerrado no sigue
  //    tomando direcciones ni pagos hasta que vuelve a abrir.
  if (!isOpenNow()) {
    return { text: MESSAGES.outOfHours() };
  }

  // 4. Tope de mensajes por hora (RF-18). Cortafuegos contra un bucle o
  //    contra alguien probando los límites, no una fricción para el uso
  //    normal — el valor por defecto son 60 mensajes.
  if (env.maxMessagesPerHour > 0) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await countRecentCustomerMessages(conversation.id, oneHourAgo);
    if (recent > env.maxMessagesPerHour) {
      return { text: MESSAGES.rateLimited() };
    }
  }

  // 5. Audio e imagen: degradación con gracia mientras no haya modelo
  //    configurado (RF-14, RF-17). Va antes que el pedido en curso porque no
  //    hay ninguna dirección ni método de pago que se pueda leer de un audio
  //    o una imagen sin transcribirlos/interpretarlos primero.
  if (input.kind === "audio") return { text: MESSAGES.voiceUnavailable() };
  if (input.kind === "image") return { text: MESSAGES.imageUnavailable() };
  if (input.kind === "unsupported") return { text: MESSAGES.unsupportedMessage() };

  // 6. ¿Pedido en curso? Lo cierra el motor determinista (RF-15).
  const orderTurn = await handleOrderTurn(conversation, input.text, input.buttonId);
  if (orderTurn) return orderTurn;

  // 7. Código escrito a mano: el respaldo de RF-27.
  const code = parseOrderCode(input.text);
  if (code) {
    const order = await findOrderByCode(code);
    if (!order) return { text: MESSAGES.orderNotFound() };
    return startOrder(conversation, order);
  }

  // 8. Botones y frases de ayuda.
  if (input.buttonId === BUTTONS.helpHowTo.id) {
    return { text: MESSAGES.howToOrder(), menu: menu() };
  }
  if (input.buttonId === BUTTONS.helpFaq.id) {
    return { text: MESSAGES.businessInfo() };
  }
  if (input.buttonId === BUTTONS.helpHuman.id || isHumanRequest(input.text)) {
    return {
      text: MESSAGES.escalated(),
      escalated: { reason: "El cliente pidió hablar con una persona." },
    };
  }

  // 9. Rutas deterministas, de lo más específico a lo más vago.
  if (isHowToOrderRequest(input.text)) {
    return { text: MESSAGES.howToOrder(), menu: menu() };
  }
  if (isMenuRequest(input.text)) {
    return { text: MESSAGES.menuLink(), menu: menu() };
  }
  if (isBusinessInfoRequest(input.text)) {
    return { text: MESSAGES.businessInfo() };
  }
  if (isHelpRequest(input.text)) {
    return {
      text: MESSAGES.help(),
      buttons: [BUTTONS.helpHowTo, BUTTONS.helpFaq, BUTTONS.helpHuman],
    };
  }

  // 10. Saludo: SIEMPRE la misma bienvenida, con la foto y el menú.
  //
  //     Sin variantes de "primera vez" vs "ya te conozco". Se intentó esa
  //     distinción y se descartó: el cliente que saluda está diciendo "quiero
  //     empezar", y en ese turno lo único que importa es que tenga enfrente
  //     cómo se pide y el botón para hacerlo. Acordarse de si ya lo saludamos
  //     agrega una rama que se puede equivocar —y se equivocó— sin mejorar en
  //     nada lo que el cliente necesita en ese momento.
  const history = await getMessages(conversation.id);
  if (isGreeting(input.text)) {
    return {
      text: MESSAGES.greeting(),
      menu: menu(),
      ...(env.welcomeImageUrl ? { image: { url: env.welcomeImageUrl } } : {}),
    };
  }

  // 11. Todo lo demás: el asesor con el modelo (RF-13). `runAdvisor` degrada
  //     solo si `OPENAI_API_KEY` falta o la llamada falla (RF-17) — no hay
  //     una rama separada para eso acá, es el mismo camino siempre.
  const catalog = await getCatalog();
  return runAdvisor(conversation.phone, catalog, toModelHistory(history));
}

/**
 * Los últimos turnos, en la forma que el modelo espera.
 *
 * Se descartan los mensajes sin texto (audio/imagen sin transcribir, tipos no
 * soportados): un turno vacío no le aporta nada al modelo y sí puede
 * confundir el patrón de la conversación.
 */
function toModelHistory(history: Message[]) {
  return history
    .filter((m) => m.text.trim().length > 0)
    .slice(-10)
    .map((m) => ({
      role: m.role === "customer" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));
}

// --- Entrega -----------------------------------------------------------------

/** Elige el envío según la forma de la respuesta. Un solo lugar decide esto,
 *  para que nadie tenga que acordarse del orden de prioridad en otro sitio.
 *  Se exporta porque `/api/internal/menu-order` también necesita entregar una
 *  respuesta sin pasar por `handleIncoming` (no hay un mensaje entrante). */
export async function deliverReply(phone: string, reply: BotReply): Promise<SendResult> {
  // Con menú, la foto viaja DENTRO del mismo mensaje como encabezado: una
  // sola notificación, con la foto arriba y el botón abajo, en vez de dos
  // mensajes donde el cliente puede quedarse en la foto sin ver el botón.
  if (reply.menu) {
    return sendCta(phone, reply.text, reply.menu.url, reply.menu.label, reply.image?.url);
  }

  // Sin menú no hay dónde meter el encabezado, así que la foto va sola y
  // antes. Si falla, se sigue igual: el texto es lo que no se puede perder.
  if (reply.image) {
    const imageResult = await sendImage(phone, reply.image.url);
    if (!imageResult.ok) {
      console.warn("[orchestrator] no se pudo mandar la imagen:", imageResult);
    }
  }

  if (reply.buttons && reply.buttons.length > 0) {
    return sendButtons(phone, reply.text, reply.buttons);
  }
  return sendText(phone, reply.text);
}
