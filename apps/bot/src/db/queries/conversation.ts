import { and, asc, eq, gte } from "drizzle-orm";

import {
  conversations,
  db,
  messages,
  type MessageKind,
  type MessageRole,
} from "@sistema/shared/db";

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;

/**
 * Registra o actualiza la conversación al llegar un mensaje del cliente.
 *
 * SIEMPRE actualiza `lastInboundAt` a ahora: es el reloj de la ventana de
 * servicio de 24 horas (`isWindowOpen` en `@sistema/shared`). Un mensaje del
 * cliente reabre la ventana aunque estuviera cerrada — es la única forma en
 * que se reabre, porque el cliente siempre inicia.
 */
export async function upsertConversationOnInbound(
  phone: string,
  profileName: string | null,
) {
  const now = new Date();

  const [existing] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.phone, phone))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(conversations)
      .set({
        lastInboundAt: now,
        ...(profileName ? { displayName: profileName } : {}),
      })
      .where(eq(conversations.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(conversations)
    .values({ phone, displayName: profileName, lastInboundAt: now })
    .returning();
  return created;
}

export async function updateConversation(
  conversationId: number,
  patch: Partial<Conversation>,
) {
  await db
    .update(conversations)
    .set(patch)
    .where(eq(conversations.id, conversationId));
}

export async function getConversationByPhone(phone: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.phone, phone))
    .limit(1);
  return conversation ?? null;
}

/**
 * Guarda un mensaje del hilo y toca `lastMessageAt`.
 *
 * `lastMessageAt` es distinto de `lastInboundAt`: el primero ordena la
 * bandeja (Fase 5) y lo mueve cualquier mensaje, del cliente o nuestro; el
 * segundo solo lo mueve el cliente, porque es el reloj de la ventana de 24 h.
 */
export async function recordMessage(
  conversationId: number,
  role: MessageRole,
  kind: MessageKind,
  text: string,
  extra?: {
    waMessageId?: string;
    mediaPath?: string;
    meta?: Record<string, unknown>;
  },
) {
  const [message] = await db
    .insert(messages)
    .values({
      conversationId,
      role,
      kind,
      text,
      waMessageId: extra?.waMessageId ?? null,
      mediaPath: extra?.mediaPath ?? null,
      meta: extra?.meta ?? null,
    })
    .returning();

  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return message;
}

/** El hilo completo, en orden. Lo usa el orquestador para el tope de mensajes
 *  (RF-18), el "primer contacto" del saludo, y el contexto del asesor. */
export async function getMessages(conversationId: number) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.id));
}

/**
 * Cuántos mensajes del CLIENTE llegaron desde `since` (RF-18).
 *
 * Cuenta filas en vez de usar un agregado SQL a propósito: a esta escala
 * (decenas de mensajes por conversación) la claridad de "traer y contar" gana
 * sobre la eficiencia marginal de un `COUNT(*)`.
 */
export async function countRecentCustomerMessages(
  conversationId: number,
  since: Date,
) {
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.role, "customer"),
        gte(messages.createdAt, since),
      ),
    );
  return rows.length;
}

/**
 * El control del asistente (Fase 5 lo expone en la bandeja).
 *
 * Al retomar se limpia `escalationReason`: si no, la bandeja seguiría
 * mostrando una alerta de algo que ya se resolvió.
 */
export async function setBotPaused(
  conversationId: number,
  paused: boolean,
  reason?: string,
) {
  await db
    .update(conversations)
    .set({
      botPaused: paused,
      escalationReason: paused ? (reason ?? null) : null,
    })
    .where(eq(conversations.id, conversationId));
}
