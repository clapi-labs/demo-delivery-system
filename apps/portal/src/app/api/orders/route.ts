import { NextResponse } from "next/server";

import { orderStatusMessage, type OrderStatus } from "@sistema/shared";
import { enqueueOrderNotification } from "@sistema/shared/db";

import { getPortalOrders, setPortalOrderStatus } from "@/db/orders";

export const dynamic = "force-dynamic";

/**
 * Pedidos del portal (RF-28, RF-29, RF-30).
 *
 * GET: el tablero (todo menos los borradores — un carrito que nadie cerró no
 * es un pedido).
 * POST: cambio de estado, y el aviso al cliente.
 *
 * **El aviso se encola, no se envía desde acá.** El portal escribe una fila
 * en `notifications` y le pide al bot que la entregue; el envío sale por
 * `apps/bot` (RN-05, un solo camino de salida). Que Meta esté caída o la
 * ventana de 24 h cerrada no puede bloquear a alguien moviendo una comanda en
 * la cocina: el estado se guarda igual y el aviso se reintenta.
 */

const VALID: OrderStatus[] = ["pending", "preparing", "sent", "delivered", "cancelled"];

export async function GET() {
  const orders = await getPortalOrders();
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    orderId?: unknown;
    status?: unknown;
  } | null;

  const orderId = Number(body?.orderId);
  const status = body?.status;

  if (!Number.isInteger(orderId) || typeof status !== "string" || !VALID.includes(status as OrderStatus)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const order = await setPortalOrderStatus(orderId, status as OrderStatus);
  if (!order) {
    return NextResponse.json({ error: "not_found_or_draft" }, { status: 404 });
  }

  // El aviso va después de guardar y **nunca** puede tumbar la respuesta: para
  // la cocina lo que importa es que la comanda se movió. Si algo de esto
  // falla, el estado ya quedó bien y el cron recoge el aviso más tarde.
  const notified = await notifyCustomer(orderId, order.status, order.code);

  return NextResponse.json({ ok: true, notified });
}

async function notifyCustomer(orderId: number, status: OrderStatus, code: string) {
  const text = orderStatusMessage(status, code);
  if (!text) return false;

  try {
    const queued = await enqueueOrderNotification(orderId, text);
    if (!queued) return false;
  } catch (error) {
    console.error("[api/orders] no se pudo encolar el aviso:", error);
    return false;
  }

  await requestDelivery();
  return true;
}

/**
 * Le pide al bot que entregue ya lo que haya pendiente.
 *
 * Es un empujón, no el camino de entrega: el cron del bot barre igual. Por eso
 * cualquier fallo se registra y se sigue — dejar el aviso para el próximo
 * barrido es un retraso, no una pérdida.
 */
async function requestDelivery() {
  const botUrl = process.env.BOT_URL;
  const secret = process.env.INTERNAL_SECRET;
  if (!botUrl || !secret) {
    console.error("[api/orders] falta BOT_URL o INTERNAL_SECRET: el aviso queda para el cron");
    return;
  }

  const base = (/^https?:\/\//i.test(botUrl) ? botUrl : `https://${botUrl}`).replace(/\/+$/, "");

  try {
    const res = await fetch(`${base}/api/internal/outbox`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) {
      console.warn(`[api/orders] el bot respondió ${res.status} al barrer el outbox`);
    }
  } catch (error) {
    console.warn("[api/orders] no se pudo avisar al bot; queda para el cron:", error);
  }
}
