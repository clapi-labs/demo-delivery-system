import { orderStatusMessage, type OrderStatus } from "@sistema/shared";
import { enqueueOrderNotification, stampDelivery } from "@sistema/shared/db";

import { setPortalOrderStatus } from "@/db/orders";
import { askBot } from "@/env";

/**
 * Cambiar el estado de un pedido, con todo lo que eso arrastra.
 *
 * Vive fuera de las rutas porque **dos sitios lo hacen**: el tablero del
 * portal y la pantalla del repartidor cuando marca una entrega (RF-53). Si
 * cada uno lo escribiera por su lado, uno de los dos se olvidaría de avisarle
 * al cliente, y nadie se daría cuenta hasta que un cliente preguntara por qué
 * a veces le llega el mensaje y a veces no.
 *
 * El orden es a propósito:
 *
 * 1. Guardar el estado. Es lo único que no puede fallar.
 * 2. Sellar la hora en la asignación (salió / llegó).
 * 3. Encolar el aviso al cliente y empujar al bot para que lo entregue ya.
 *
 * Del paso 3 en adelante **nada puede tumbar la respuesta**: para la cocina lo
 * que importa es que la comanda se movió. Si el aviso falla, el estado ya
 * quedó bien y el cron del outbox lo recoge más tarde (RF-31).
 */
export async function applyOrderStatus(orderId: number, status: OrderStatus) {
  const order = await setPortalOrderStatus(orderId, status);
  if (!order) return null;

  try {
    await stampDelivery(orderId, order.status);
  } catch (error) {
    console.error("[portal] no se pudo sellar la hora de la entrega:", error);
  }

  const notified = await notifyCustomer(orderId, order.status, order.code);
  return { ...order, notified };
}

async function notifyCustomer(orderId: number, status: OrderStatus, code: string) {
  const text = orderStatusMessage(status, code);
  if (!text) return false;

  try {
    const queued = await enqueueOrderNotification(orderId, text);
    if (!queued) return false;
  } catch (error) {
    console.error("[portal] no se pudo encolar el aviso:", error);
    return false;
  }

  // Un empujón, no el camino de entrega: el cron del bot barre igual, así que
  // cualquier fallo se registra y se sigue.
  const answer = await askBot("/api/internal/outbox", {});
  if (answer === null) {
    console.error("[portal] falta BOT_URL o INTERNAL_SECRET: el aviso queda para el cron");
  } else if (!answer.ok) {
    console.warn(`[portal] el bot no pudo barrer el outbox (${answer.reason ?? "sin motivo"})`);
  }

  return true;
}
