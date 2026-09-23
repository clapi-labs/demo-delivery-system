/**
 * La bandeja de conversaciones del lado del navegador.
 *
 * Las formas siguen de cerca las tablas `conversations` y `messages` del
 * esquema (`packages/shared/src/db/schema.ts`): conectar la bandeja a Neon es
 * cambiar de dónde salen estos objetos, no rediseñar la pantalla.
 */

export type MessageRole = "customer" | "bot" | "agent";

export type InboxMessage = {
  id: string;
  role: MessageRole;
  /** `system` son avisos de la bandeja ("Pausaste el bot"), no mensajes que
   *  el cliente haya visto. Van centrados y sin burbuja. */
  kind: "text" | "audio" | "image" | "button" | "system";
  text: string;
  createdAt: string;
  /** Botones o link al menú que el bot adjuntó, para pintarlos igual que
   *  los vio el cliente. Misma idea que `messages.meta`. */
  meta?: { buttons?: string[]; cta?: string };
  /** Solo en pantalla: enviado desde aquí y todavía sin confirmar. */
  pending?: boolean;
};

export type ConversationPhase = "advising" | "collecting_address" | "awaiting_payment" | "awaiting_voucher";

export type InboxConversation = {
  id: number;
  phone: string;
  displayName: string | null;
  /** Quién responde. `true` = el bot calla y responde una persona. */
  botPaused: boolean;
  /** Por qué el bot pidió ayuda. Mientras exista, el chat "te necesita". */
  escalationReason: string | null;
  phase: ConversationPhase;
  /** El reloj de la ventana de 24 h de WhatsApp. */
  lastInboundAt: string | null;
  lastMessageAt: string;
  unread: number;
  messages: InboxMessage[];
};

export const PHASE_LABEL: Record<ConversationPhase, string> = {
  advising: "Conversando",
  collecting_address: "Confirmando dirección",
  awaiting_payment: "Eligiendo pago",
  awaiting_voucher: "Esperando comprobante",
};

export function needsAttention(c: InboxConversation) {
  return c.botPaused && c.escalationReason !== null;
}

export function conversationName(c: Pick<InboxConversation, "displayName" | "phone">) {
  return c.displayName ?? `+${c.phone}`;
}

export function initials(name: string) {
  const parts = name.replace(/[^\p{L}\s]/gu, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "#";
}

/** Respuestas rápidas del equipo. Se insertan en el cuadro, no se envían
 *  solas: siempre hay una persona revisando antes de mandar. */
export const QUICK_REPLIES = [
  "¡Hola! Te habla una persona del equipo, ¿en qué te ayudo?",
  "Tu pedido ya está en preparación",
  "Tu pedido va en camino",
  "¿Me confirmas la dirección, por favor?",
  "Qué pena la demora, ya lo estamos revisando.",
  "¡Gracias por tu compra!",
];
