import { NextResponse } from "next/server";

import { createCourierToken, type CourierKind, type CourierPayment } from "@sistema/shared";
import {
  deleteCourier,
  listCouriers,
  saveCourier,
  setCourierActive,
  type Courier,
} from "@sistema/shared/db";

import { env } from "@/env";

export const dynamic = "force-dynamic";

/**
 * La libreta de repartidores (RF-49).
 *
 * GET: todos, incluidos los inactivos — esta pantalla es de administración, y
 * un domiciliario de vacaciones tiene que poder volver sin registrarlo otra
 * vez.
 * POST: crear, editar, activar/desactivar y borrar.
 *
 * El link de la pantalla del repartidor se firma **acá y no en el navegador**:
 * el secreto no puede salir al cliente.
 */

const KINDS: CourierKind[] = ["internal", "agency"];
const PAYMENTS: CourierPayment[] = ["cash_base", "account"];

/**
 * El link de su pantalla, firmado.
 *
 * Solo para los propios: una agencia no marca entregas, así que darle un link
 * sería darle acceso a datos de clientes sin motivo. `null` también cuando
 * falta el secreto — mejor que la pantalla lo diga que mandar un link que
 * nunca va a abrir.
 */
function driverUrl(courier: Courier, origin: string) {
  if (courier.kind !== "internal") return null;
  if (!env.courierTokenSecret) return null;
  const token = createCourierToken(courier.id, env.courierTokenSecret);
  return `${origin}/repartidor?t=${token}`;
}

function origin(request: Request) {
  if (env.portalUrl) return env.portalUrl;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const couriers = await listCouriers({ includeInactive: true });
  const base = origin(request);

  return NextResponse.json({
    couriers: couriers.map((c) => ({ ...c, driverUrl: driverUrl(c, base) })),
    /** Para que la pantalla explique qué falta en vez de callarse. */
    linksReady: Boolean(env.courierTokenSecret),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;

  if (action === "active") {
    const id = Number(body?.courierId);
    if (!Number.isInteger(id) || typeof body?.active !== "boolean") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    await setCourierActive(id, body.active);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const id = Number(body?.courierId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    await deleteCourier(id);
    return NextResponse.json({ ok: true });
  }

  if (action === "save") {
    const input = body?.courier as Record<string, unknown> | undefined;
    const kind = input?.kind;
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    // Se guarda solo lo que sirve para escribirle: un repartidor sin teléfono
    // no se puede despachar, y guardarlo a medias es un registro que falla
    // justo cuando hay prisa.
    const phone = typeof input?.phone === "string" ? input.phone.replace(/\D/g, "") : "";

    if (!KINDS.includes(kind as CourierKind) || !name || phone.length < 10) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const paymentMode = PAYMENTS.includes(input?.paymentMode as CourierPayment)
      ? (input?.paymentMode as CourierPayment)
      : null;

    const saved = await saveCourier({
      id: typeof input?.id === "number" && input.id > 0 ? input.id : undefined,
      kind: kind as CourierKind,
      name,
      phone,
      paymentMode,
      notes: typeof input?.notes === "string" ? input.notes : null,
      active: typeof input?.active === "boolean" ? input.active : true,
      sortOrder: typeof input?.sortOrder === "number" ? input.sortOrder : 0,
    });

    return NextResponse.json({
      ok: true,
      courier: { ...saved, driverUrl: driverUrl(saved, origin(request)) },
    });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
