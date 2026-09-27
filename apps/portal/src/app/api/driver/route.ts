import { NextResponse } from "next/server";

import { startOfBusinessDay, verifyCourierToken } from "@sistema/shared";
import { courierTasks, getCourier } from "@sistema/shared/db";

import { env } from "@/env";
import { applyOrderStatus } from "@/server/order-status";

export const dynamic = "force-dynamic";

/**
 * La pantalla del repartidor (RF-53).
 *
 * **La autoriza el token firmado del link**, no una sesión: un domiciliario no
 * va a registrarse en un portal ni a acordarse de una contraseña, y pedírselo
 * es garantizar que no lo use y siga llamando al local. El token dice de qué
 * domiciliario es (`courier-token.ts`), y con eso solo ve **sus** pedidos.
 *
 * Marcar entregado pasa por `applyOrderStatus`, el mismo camino del tablero:
 * así el cliente recibe su aviso de WhatsApp igual que si lo hubiera marcado
 * el cajero, y la hora de entrega queda sellada en la asignación.
 */

async function courierFrom(token: string | null) {
  if (!env.courierTokenSecret) return { error: "no_secret" as const };
  const payload = verifyCourierToken(token, env.courierTokenSecret);
  if (!payload) return { error: "bad_token" as const };

  const courier = await getCourier(payload.courierId);
  if (!courier || !courier.active) return { error: "bad_token" as const };
  return { courier };
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  const found = await courierFrom(token);
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: 401 });

  const tasks = await courierTasks(found.courier.id, startOfBusinessDay());

  return NextResponse.json({
    courier: { id: found.courier.id, name: found.courier.name },
    tasks,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const found = await courierFrom(typeof body?.t === "string" ? body.t : null);
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: 401 });

  const orderId = Number(body?.orderId);
  if (!Number.isInteger(orderId) || body?.action !== "deliver") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Solo puede cerrar lo suyo: sin esto, un token válido cerraría el pedido de
  // cualquier otro cambiando un número en el cuerpo de la petición.
  const tasks = await courierTasks(found.courier.id, startOfBusinessDay());
  if (!tasks.some((t) => t.orderId === orderId)) {
    return NextResponse.json({ error: "not_yours" }, { status: 403 });
  }

  const result = await applyOrderStatus(orderId, "delivered");
  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, notified: result.notified });
}
