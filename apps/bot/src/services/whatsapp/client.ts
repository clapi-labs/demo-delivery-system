import { isWindowOpen } from "@sistema/shared";

import { getConversationByPhone } from "@/db/queries/conversation";
import { env } from "@/env";

/**
 * El ÚNICO camino de salida hacia WhatsApp (RN-05).
 *
 * Todo mensaje que le llega al cliente pasa por acá: las respuestas del bot,
 * los avisos del portal y lo que escribe un agente. No se construye un
 * segundo camino de envío — es lo que hace que el registro de lo enviado
 * tenga una sola fuente y que la comprobación de la ventana de 24 h no se
 * pueda saltar por accidente desde otro sitio.
 */

export type SendResult =
  | { ok: true }
  | { ok: false; reason: "bot_inactive" }
  | { ok: false; reason: "window_closed" }
  | { ok: false; reason: "http_error"; status: number; body: unknown }
  | { ok: false; reason: "network_error"; error: string };

const MAX_BUTTONS = 3;
const MAX_BUTTON_TITLE = 20;

function graphUrl() {
  return `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`;
}

/**
 * ¿Es nuestro turno en el número compartido?
 *
 * El número de WhatsApp se rota a mano con otro bot (Qanelo); nginx decide
 * quién RECIBE, pero nada externo nos impide MANDAR si algo de este lado
 * queda corriendo fuera de horario — un cron del outbox, un reintento en
 * vuelo. Por eso el chequeo va primero, antes incluso de la ventana de 24 h:
 * más barato, y es el que de verdad puede mandar un mensaje del bot
 * equivocado por el número del restaurante.
 */
function checkActive(): boolean {
  return env.botActive;
}

/**
 * Comprueba la ventana de 24 h ANTES de intentar cualquier envío (RF-09).
 *
 * No es una optimización: mandarlo igual y dejar que Meta lo rechace gasta
 * una llamada HTTP para llegar al mismo resultado, y complica distinguir ese
 * rechazo de un error real. Más vale no intentarlo y decirlo claro.
 */
async function checkWindow(phone: string): Promise<boolean> {
  const conversation = await getConversationByPhone(phone);
  return isWindowOpen(conversation?.lastInboundAt ?? null);
}

async function post(payload: Record<string, unknown>): Promise<SendResult> {
  try {
    const response = await fetch(graphUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { ok: false, reason: "http_error", status: response.status, body };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "network_error", error: String(error) };
  }
}

/** Texto libre. El envío más común: saludo, respuestas del asesor, cierre del pedido. */
export async function sendText(phone: string, text: string): Promise<SendResult> {
  if (!checkActive()) return { ok: false, reason: "bot_inactive" };
  if (!(await checkWindow(phone))) return { ok: false, reason: "window_closed" };

  return post({
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body: text },
  });
}

/**
 * Botones de respuesta rápida.
 *
 * Máximo 3, títulos de 20 caracteres — son límites de Meta, no nuestros. De
 * más de 3 se toman los primeros 3 con una advertencia; un título largo se
 * recorta en vez de fallar la llamada completa: es mejor un botón truncado
 * que ningún botón.
 */
export async function sendButtons(
  phone: string,
  text: string,
  buttons: { id: string; title: string }[],
): Promise<SendResult> {
  if (!checkActive()) return { ok: false, reason: "bot_inactive" };
  if (!(await checkWindow(phone))) return { ok: false, reason: "window_closed" };

  if (buttons.length > MAX_BUTTONS) {
    console.warn(
      `[whatsapp] se recortaron los botones de ${buttons.length} a ${MAX_BUTTONS}`,
    );
  }

  return post({
    messaging_product: "whatsapp",
    to: phone,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text },
      action: {
        buttons: buttons.slice(0, MAX_BUTTONS).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, MAX_BUTTON_TITLE) },
        })),
      },
    },
  });
}

/**
 * Imagen por URL pública.
 *
 * Meta descarga la imagen él mismo desde esa URL, así que tiene que ser
 * pública y servir un `Content-Type` de imagen — no vale una ruta protegida
 * ni una página HTML que "muestra" la foto.
 *
 * Se usa para la bienvenida. Si falla no se corta el turno: el texto y el
 * botón del menú salen igual (ver `deliverReply`), porque una foto que no
 * cargó no puede costarle el pedido al cliente.
 */
export async function sendImage(
  phone: string,
  imageUrl: string,
  caption?: string,
): Promise<SendResult> {
  if (!checkActive()) return { ok: false, reason: "bot_inactive" };
  if (!(await checkWindow(phone))) return { ok: false, reason: "window_closed" };

  return post({
    messaging_product: "whatsapp",
    to: phone,
    type: "image",
    image: { link: imageUrl, ...(caption ? { caption } : {}) },
  });
}

/**
 * El botón que abre el menú, con el link firmado (ADR-05).
 *
 * `imageUrl` pone una foto de encabezado **en el mismo mensaje**: foto arriba,
 * texto en el medio, botón abajo. Confirmado contra la API real — el header
 * de tipo `image` sí lo acepta `cta_url`, aunque la documentación pública no
 * lo diga en ninguna parte fácil de encontrar.
 *
 * Es mejor que mandar la foto aparte: son dos notificaciones en vez de una, y
 * el cliente puede quedarse mirando la foto sin ver el botón que viene
 * después.
 */
export async function sendCta(
  phone: string,
  text: string,
  url: string,
  label: string,
  imageUrl?: string,
): Promise<SendResult> {
  if (!checkActive()) return { ok: false, reason: "bot_inactive" };
  if (!(await checkWindow(phone))) return { ok: false, reason: "window_closed" };

  return post({
    messaging_product: "whatsapp",
    to: phone,
    type: "interactive",
    interactive: {
      type: "cta_url",
      ...(imageUrl ? { header: { type: "image", image: { link: imageUrl } } } : {}),
      body: { text },
      action: {
        name: "cta_url",
        parameters: { display_text: label.slice(0, MAX_BUTTON_TITLE), url },
      },
    },
  });
}
