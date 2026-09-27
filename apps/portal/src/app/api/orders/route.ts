import { NextResponse } from "next/server";

import { type OrderStatus } from "@sistema/shared";

import { getPortalOrders } from "@/db/orders";
import { applyOrderStatus } from "@/server/order-status";

export const dynamic = "force-dynamic";

/**
 * Pedidos del portal (RF-28, RF-29, RF-30).
 *
 * GET: el tablero (todo menos los borradores — un carrito que nadie cerró no
 * es un pedido).
 * POST: cambio de estado, y el aviso al cliente.
 *
 * El cambio lo hace `applyOrderStatus`, compartido con la pantalla del
 * repartidor: los dos sellan la hora de la entrega y le avisan al cliente por
 * el mismo camino. **El aviso se encola, no se envía desde acá**: el portal
 * escribe una fila en `notifications` y le pide al bot que la entregue; el
 * envío sale por `apps/bot` (RN-05, un solo camino de salida).
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

  const result = await applyOrderStatus(orderId, status as OrderStatus);
  if (!result) {
    return NextResponse.json({ error: "not_found_or_draft" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, notified: result.notified });
}
