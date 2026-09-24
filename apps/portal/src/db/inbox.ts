import { asc, desc, inArray } from "drizzle-orm";

import { conversations, db, messages } from "@sistema/shared/db";

import type { InboxConversation, InboxMessage } from "@/lib/inbox";

/**
 * La bandeja que ve el portal (RF-32 a RF-36), leída directo de las tablas
 * `conversations`/`messages` que ya escribe `apps/bot`.
 *
 * `conversations.phone` es `unique()` en el esquema: un cliente tiene UNA
 * fila, siempre — no hay forma de que aparezcan dos chats para el mismo
 * número, porque `upsertConversationOnInbound` (el bot) actualiza esa misma
 * fila en vez de crear otra.
 */
export async function getInboxConversations(): Promise<InboxConversation[]> {
  const convRows = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);

  if (convRows.length === 0) return [];

  // Una sola consulta para todos los hilos, no una por conversación.
  const msgRows = await db
    .select()
    .from(messages)
    .where(inArray(messages.conversationId, convRows.map((c) => c.id)))
    .orderBy(asc(messages.id));

  const byConversation = new Map<number, InboxMessage[]>();
  for (const m of msgRows) {
    const list = byConversation.get(m.conversationId) ?? [];
    list.push({
      id: String(m.id),
      role: m.role,
      kind: m.kind,
      text: m.text,
      createdAt: m.createdAt.toISOString(),
      meta: (m.meta as InboxMessage["meta"] | null) ?? undefined,
    });
    byConversation.set(m.conversationId, list);
  }

  return convRows.map((c) => ({
    id: c.id,
    // Hoy todo llega por WhatsApp; no hay otro canal en el esquema.
    channel: "whatsapp" as const,
    phone: c.phone,
    displayName: c.displayName,
    botPaused: c.botPaused,
    escalationReason: c.escalationReason,
    phase: c.phase,
    lastInboundAt: c.lastInboundAt ? c.lastInboundAt.toISOString() : null,
    lastMessageAt: c.lastMessageAt.toISOString(),
    // No hay columna de leído/no leído todavía (ver TODO en portal-api.ts).
    unread: 0,
    messages: byConversation.get(c.id) ?? [],
  }));
}
