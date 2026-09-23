import { NextResponse } from "next/server";

import type { OrderStatus } from "@sistema/shared/db";

import { getPortalOrders, setPortalOrderStatus } from "@/db/orders";

export const dynamic = "force-dynamic";

/**
 * Pedidos del portal (RF-28, RF-29).
 *
 * GET: el tablero (todo menos los borradores — un carrito que nadie cerró no
 * es un pedido).
 * POST: cambio de estado.
 *
 * **Todavía no encola el aviso al cliente** (RF-30, el outbox): eso es el
 * siguiente paso. Hoy el cambio de estado se guarda y el cliente no se
 * entera, que es mejor que mandarlo directo a Meta desde acá y construir un
 * segundo camino de salida (RN-05).
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

  const ok = await setPortalOrderStatus(orderId, status as OrderStatus);
  if (!ok) {
    return NextResponse.json({ error: "not_found_or_draft" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
