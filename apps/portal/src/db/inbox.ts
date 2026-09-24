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
/**
 * `messages.meta` es `jsonb` sin forma garantizada por el tipo — y hasta
 * hace poco `apps/bot` guardaba ahí el `{id,title}[]` interno de los
 * botones en vez de los títulos. Esa fila vieja sigue en la base y
 * `Thread.tsx` (que espera `buttons: string[]`) revienta al pintar un
 * objeto crudo como hijo de React. Se sanea acá, en la frontera con la
 * base, para que el resto del portal pueda confiar en el tipo sin volver
 * a comprobarlo.
 */
function sanitizeMeta(raw: unknown): InboxMessage["meta"] {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;

  const buttons = Array.isArray(r.buttons)
    ? r.buttons
        .map((b) =>
          typeof b === "string"
            ? b
            : b && typeof b === "object" && typeof (b as { title?: unknown }).title === "string"
              ? (b as { title: string }).title
              : null,
        )
        .filter((b): b is string => b !== null)
    : undefined;

  const menu = r.menu as { label?: unknown } | undefined;
  const cta =
    typeof r.cta === "string"
      ? r.cta
      : typeof menu?.label === "string"
        ? menu.label
        : undefined;

  if (!buttons?.length && !cta) return undefined;
  return { ...(buttons?.length ? { buttons } : {}), ...(cta ? { cta } : {}) };
}

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
      meta: sanitizeMeta(m.meta),
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
