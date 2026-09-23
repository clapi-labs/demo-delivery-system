import { and, desc, eq, ne } from "drizzle-orm";

import {
  db,
  orderItems,
  orders,
  type OrderStatus,
  type PaymentMethod,
  type SelectedOption,
} from "@sistema/shared/db";

/**
 * Los pedidos que ve el restaurante (RF-28, RF-29).
 *
 * **Los borradores no se muestran nunca.** Un carrito que alguien armó en el
 * menú y no cerró por WhatsApp no es un pedido: nadie lo va a preparar, y
 * mostrarlo llenaría el tablero de ruido que el restaurante tendría que
 * aprender a ignorar. El filtro es `status != "draft"`.
 */

export type PortalOrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  options: SelectedOption[];
};

/**
 * Los estados que el portal SÍ puede ver.
 *
 * `draft` queda fuera del tipo, no solo de la consulta: así el compilador
 * impide que una pantalla intente pintar un borrador, en vez de descubrirlo
 * con un `undefined` en una etiqueta de estado.
 */
export type PortalOrderStatus = Exclude<OrderStatus, "draft">;

export type PortalOrder = {
  id: number;
  code: string;
  status: PortalOrderStatus;
  phone: string | null;
  customerName: string | null;
  address: string | null;
  paymentMethod: PaymentMethod | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: Date;
  items: PortalOrderItem[];
};

export async function getPortalOrders(): Promise<PortalOrder[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(ne(orders.status, "draft"))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  if (rows.length === 0) return [];

  // Una sola consulta para todos los renglones, no una por pedido: con 100
  // pedidos en pantalla, lo segundo son 100 viajes a la base por cada carga.
  const allItems = await db.select().from(orderItems);
  const byOrder = new Map<number, PortalOrderItem[]>();
  for (const item of allItems) {
    const list = byOrder.get(item.orderId) ?? [];
    list.push({
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      options: item.selectedOptions,
    });
    byOrder.set(item.orderId, list);
  }

  return rows.map((order) => ({
    id: order.id,
    code: order.code,
    // La consulta ya excluyó los borradores; el `as` solo le dice eso al
    // compilador, que no puede deducirlo de un `ne()`.
    status: order.status as PortalOrderStatus,
    phone: order.phone,
    customerName: order.customerName,
    address: order.address,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    createdAt: order.createdAt,
    items: byOrder.get(order.id) ?? [],
  }));
}

/**
 * Cambia el estado de un pedido desde el tablero.
 *
 * Nunca toca un borrador (`status != "draft"`): el portal no puede convertir
 * en pedido real algo que jamás pasó por el canje del código — ese es el
 * candado de ADR-02, y vale igual desde acá.
 */
export async function setPortalOrderStatus(orderId: number, status: OrderStatus) {
  const updated = await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), ne(orders.status, "draft")))
    .returning();

  return updated.length > 0;
}
