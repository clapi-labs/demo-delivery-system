import { and, asc, eq, isNull, lt } from "drizzle-orm";

import { db } from "../client";
import { conversations, notifications, orders } from "../schema";

/**
 * El outbox de avisos al cliente (RF-30, RF-31).
 *
 * **Por qué una tabla y no una llamada directa.** El portal podría pedirle al
 * bot que envíe en el mismo clic, pero entonces un fallo de Meta —o la
 * ventana de 24 h cerrada— dejaría al cocinero sin poder mover una comanda.
 * El cambio de estado se guarda siempre; el aviso es un encargo aparte que se
 * reintenta.
 *
 * Quien lo barre es `apps/bot`, el único camino de salida (RN-05).
 */

/** Después de esto se deja de intentar. Un aviso que lleva cinco intentos
 *  fallidos ya no es urgente: lo que sea que lo bloquea no se va a arreglar
 *  solo, y seguir reintentando llena la tabla de ruido. */
export const MAX_ATTEMPTS = 5;

/**
 * Encola el aviso de un pedido.
 *
 * Devuelve `false` si el pedido no tiene teléfono o si ese teléfono nunca
 * abrió conversación — sin conversación no hay a quién escribirle, y no es un
 * error: un pedido puede existir sin que el cliente haya escrito.
 */
export async function enqueueOrderNotification(orderId: number, text: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.phone) return false;

  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.phone, order.phone))
    .limit(1);
  if (!conversation) return false;

  await db.insert(notifications).values({
    conversationId: conversation.id,
    orderId,
    text,
  });
  return true;
}

export type PendingNotification = {
  id: number;
  conversationId: number;
  phone: string;
  text: string;
  attempts: number;
};

/** Lo que falta por entregar, lo más viejo primero y sin los que ya agotaron
 *  sus intentos. Trae el teléfono resuelto para que quien envíe no tenga que
 *  volver a consultarlo uno por uno. */
export async function pendingNotifications(limit = 20): Promise<PendingNotification[]> {
  const rows = await db
    .select({
      id: notifications.id,
      conversationId: notifications.conversationId,
      phone: conversations.phone,
      text: notifications.text,
      attempts: notifications.attempts,
    })
    .from(notifications)
    .innerJoin(conversations, eq(notifications.conversationId, conversations.id))
    .where(and(isNull(notifications.deliveredAt), lt(notifications.attempts, MAX_ATTEMPTS)))
    .orderBy(asc(notifications.id))
    .limit(limit);

  return rows;
}

export async function markNotificationDelivered(id: number) {
  await db
    .update(notifications)
    .set({ deliveredAt: new Date(), lastError: null })
    .where(eq(notifications.id, id));
}

/**
 * Un intento que no salió.
 *
 * Suma el intento y guarda el motivo. La ventana cerrada cuenta como intento
 * igual que un error de red: son 24 horas, y con cinco intentos espaciados por
 * el cron el aviso muere mucho antes de que la ventana se reabra sola. Que
 * caduque es lo correcto — "tu pedido va en camino" no sirve de nada mañana.
 */
export async function markNotificationFailed(id: number, attempts: number, reason: string) {
  await db
    .update(notifications)
    .set({ attempts: attempts + 1, lastError: reason })
    .where(eq(notifications.id, id));
}
