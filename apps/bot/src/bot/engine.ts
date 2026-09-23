import { formatCOP } from "@sistema/shared";

import type { Conversation } from "@/db/queries/conversation";
import { updateConversation } from "@/db/queries/conversation";
import {
  findOrderById,
  getOrderItems,
  redeemOrder,
  updateOrder,
  type Order,
} from "@/db/queries/orders";

import { assertMenuOrder } from "./order-guard";
import { BUTTONS, MESSAGES } from "./messages";
import type { BotReply } from "./types";

/**
 * El motor del pedido (RF-15).
 *
 * Solo se alcanza después de canjear un código. Captura dirección y método de
 * pago y cierra. **Es código determinista, no modelo** (ADR-09): un pedido
 * tiene respuesta correcta y no se negocia con un modelo de lenguaje.
 */

/** Canjea el código y arranca el cierre del pedido (RF-26). */
export async function startOrder(
  conversation: Conversation,
  order: Order,
): Promise<BotReply> {
  const claimed = await redeemOrder(order.id, conversation.phone);
  if (!claimed) {
    return { text: MESSAGES.orderAlreadyRedeemed(order.code) };
  }

  // `order` es la foto ANTERIOR al canje: su `redeemedAt` todavía dice null.
  // Hay que releerlo o `assertMenuOrder` rechaza un pedido que acabamos de
  // canjear nosotros mismos — el candado leyendo un dato que él mismo dejó
  // obsoleto.
  const redeemed = (await findOrderById(order.id)) ?? order;

  const items = await getOrderItems(order.id);
  if (items.length === 0) {
    return { text: MESSAGES.orderItemsGone() };
  }

  const lines = items.map((item) => {
    const options = item.selectedOptions.map((o) => o.name).join(", ");
    const suffix = options ? ` (${options})` : "";
    return `${item.quantity}× ${item.nameSnapshot}${suffix} — ${formatCOP(item.lineTotal)}`;
  });

  // El menú ya recogió dirección y pago: no queda nada que preguntar, así que
  // el pedido se cierra de una. Volver a pedir por chat lo que el cliente
  // acaba de escribir en el menú es la fricción que este camino existe para
  // quitar.
  //
  // El candado de ADR-02 se comprueba igual que en el camino largo: el pedido
  // sigue teniendo que venir del menú y estar canjeado.
  if (redeemed.address && redeemed.paymentMethod) {
    if (!assertMenuOrder(redeemed)) {
      return { text: MESSAGES.ordersOnlyFromMenu() };
    }

    await updateOrder(redeemed.id, { status: "pending" });
    await updateConversation(conversation.id, {
      phase: "advising",
      activeOrderId: null,
    });

    return {
      text: MESSAGES.orderConfirmedFull({
        code: redeemed.code,
        name: redeemed.customerName,
        address: redeemed.address,
        total: redeemed.subtotal,
        method: redeemed.paymentMethod,
        items: lines,
      }),
    };
  }

  // Camino largo: el pedido llegó sin dirección o sin pago (un código viejo,
  // o el respaldo manual). Se pregunta por chat, como siempre.
  await updateConversation(conversation.id, {
    phase: "collecting_address",
    activeOrderId: order.id,
  });

  return { text: MESSAGES.orderReceived(order.code, order.subtotal, lines) };
}

/**
 * Un turno dentro del cierre del pedido.
 *
 * Devuelve `null` si la conversación no está en fase de pedido, para que el
 * orquestador siga su camino normal.
 */
export async function handleOrderTurn(
  conversation: Conversation,
  text: string,
  buttonId?: string,
): Promise<BotReply | null> {
  if (conversation.phase === "advising" || !conversation.activeOrderId) {
    return null;
  }

  const order = await findOrderById(conversation.activeOrderId);
  if (!order) {
    // El pedido desapareció (borrado a mano, por ejemplo). Se vuelve a lo
    // normal en vez de dejar la conversación atascada en un paso imposible.
    await updateConversation(conversation.id, {
      phase: "advising",
      activeOrderId: null,
    });
    return null;
  }

  if (conversation.phase === "collecting_address") {
    if (!looksLikeAddress(text)) {
      return { text: MESSAGES.askAddressAgain() };
    }

    await updateOrder(order.id, { address: text.trim() });
    await updateConversation(conversation.id, { phase: "awaiting_payment" });

    return {
      text: MESSAGES.askPayment(text.trim()),
      buttons: [BUTTONS.payCash, BUTTONS.payTransfer],
    };
  }

  // awaiting_payment
  const method = readPaymentMethod(text, buttonId);
  if (!method) {
    return {
      text: "¿Efectivo o transferencia?",
      buttons: [BUTTONS.payCash, BUTTONS.payTransfer],
    };
  }

  return closeOrder(conversation, order, method);
}

async function closeOrder(
  conversation: Conversation,
  order: Order,
  method: "efectivo" | "transferencia",
): Promise<BotReply> {
  // El candado, en el único punto donde un pedido pasa a ser real.
  if (!assertMenuOrder(order)) {
    await updateConversation(conversation.id, {
      phase: "advising",
      activeOrderId: null,
    });
    return { text: MESSAGES.ordersOnlyFromMenu() };
  }

  // Los dos métodos cierran igual en esta fase: el pedido pasa a `pending` y
  // la conversación vuelve a `advising`. La diferencia está en el mensaje —
  // el de transferencia pide el comprobante — no en el estado.
  //
  // El comprobante en sí (recibirlo, guardarlo, leerlo con visión, validar la
  // referencia) es la Fase 5 (`bot/voucher.ts`, RF-37 a RF-39). Ese código no
  // depende de una fase de conversación especial: busca el pedido más
  // reciente de este teléfono con `paymentMethod = "transferencia"` y sin
  // comprobante todavía, así que no hace falta dejar la conversación en un
  // estado intermedio que nadie atendería hasta entonces.
  await updateOrder(order.id, { paymentMethod: method, status: "pending" });
  await updateConversation(conversation.id, {
    phase: "advising",
    activeOrderId: null,
  });

  return {
    text:
      method === "efectivo"
        // `subtotal`, no `total`: estos mensajes le suman el domicilio ellos
        // mismos, y `order.total` ya lo trae incluido — pasarlo cobraba el
        // domicilio dos veces en el texto que lee el cliente.
        ? MESSAGES.orderConfirmedCash(order.code, order.subtotal)
        : MESSAGES.orderConfirmedTransfer(order.code, order.subtotal),
  };
}

/**
 * ¿Esto parece una dirección?
 *
 * Deliberadamente laxo: pedirle a alguien que reescriba una dirección válida
 * molesta más de lo que evita. Solo se rechaza lo que claramente no lo es
 * ("sí", "ok", "ya"), que es cuando el cliente contestó otra cosa.
 */
function looksLikeAddress(text: string) {
  const clean = text.trim();
  if (clean.length < 8) return false;
  return /\d/.test(clean) || clean.split(/\s+/).length >= 3;
}

function readPaymentMethod(
  text: string,
  buttonId?: string,
): "efectivo" | "transferencia" | null {
  if (buttonId === BUTTONS.payCash.id) return "efectivo";
  if (buttonId === BUTTONS.payTransfer.id) return "transferencia";

  const t = text.toLowerCase();
  if (/efectivo|cash|plata|contra ?entrega/.test(t)) return "efectivo";
  if (/transfer|nequi|daviplata|bancolombia|consign/.test(t)) {
    return "transferencia";
  }
  return null;
}
