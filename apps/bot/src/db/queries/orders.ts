import { and, eq, isNull } from "drizzle-orm";

import { db, orderItems, orders, type OrderStatus } from "@sistema/shared/db";

export type Order = typeof orders.$inferSelect;

export async function findOrderByCode(code: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.code, code))
    .limit(1);
  return order ?? null;
}

export async function findOrderById(orderId: number) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return order ?? null;
}

export async function getOrderItems(orderId: number) {
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function updateOrder(orderId: number, patch: Partial<Order>) {
  await db
    .update(orders)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

/**
 * Marca el código como usado y lo asocia al teléfono que lo canjeó (RN-01).
 *
 * Devuelve `false` si ya estaba canjeado. Se comprueba contra la base y no
 * contra el estado en memoria: dos entregas casi simultáneas de Meta no
 * pueden canjear el mismo pedido dos veces — el `UPDATE ... WHERE
 * redeemed_at IS NULL` solo afecta una fila si dos llegan a la vez.
 */
export async function redeemOrder(orderId: number, phone: string) {
  const result = await db
    .update(orders)
    .set({ redeemedAt: new Date(), phone, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), isNull(orders.redeemedAt)))
    .returning();

  return result.length > 0;
}

export async function setOrderStatus(orderId: number, status: OrderStatus) {
  await updateOrder(orderId, { status });
}
