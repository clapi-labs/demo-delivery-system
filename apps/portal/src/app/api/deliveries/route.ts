import { NextResponse } from "next/server";

import {
  businessDayRange,
  courierBrief,
  createCourierToken,
  dispatchTicket,
  type CourierPayment,
} from "@sistema/shared";
import {
  assignDelivery,
  deliveriesByOrder,
  getCourier,
  markDeliveryNotified,
  setDeliveryVehicle,
  settlement,
} from "@sistema/shared/db";

import { getOrderForDelivery } from "@/db/orders";
import { askBot, env } from "@/env";

export const dynamic = "force-dynamic";

/**
 * Asignación logística de un pedido (RF-50 a RF-54).
 *
 * GET: el cierre de turno de hoy — quién llevó qué y cómo se cobra.
 * POST: asignar, anotar el número de la moto, y avisarle por WhatsApp al
 * domiciliario propio.
 *
 * **El aviso sale por `apps/bot`, no de acá** (RN-05, un solo camino de
 * salida). El portal redacta la ficha —el texto vive en `@sistema/shared` para
 * que sea la misma que se copia al chat de la agencia— y el bot la manda. Si
 * la ventana de 24 h está cerrada, esto **no es un error**: se responde el
 * motivo y la pantalla ofrece el atajo de WhatsApp, que es como se trabaja con
 * las agencias.
 */

const PAYMENTS: CourierPayment[] = ["cash_base", "account"];

export async function GET() {
  const { since, until } = businessDayRange();
  const rows = await settlement(since, until);
  return NextResponse.json({ settlement: rows, since: since.toISOString(), until: until.toISOString() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;
  const orderId = Number(body?.orderId);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (action === "assign") {
    const courierId = Number(body?.courierId);
    if (!Number.isInteger(courierId)) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const paymentMode = PAYMENTS.includes(body?.paymentMode as CourierPayment)
      ? (body?.paymentMode as CourierPayment)
      : null;
    const vehicleCode = typeof body?.vehicleCode === "string" ? body.vehicleCode : null;

    const delivery = await assignDelivery(orderId, courierId, { paymentMode, vehicleCode });
    if (!delivery) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // La ficha se redacta **acá y no en el navegador**: lleva el nombre y la
    // dirección del negocio, que viven en variables de entorno que el cliente
    // no ve. Compuesta en el navegador saldría con los valores por defecto.
    const order = await getOrderForDelivery(orderId);
    const courier = await getCourier(courierId);
    const ticket =
      order && courier ? dispatchTicket(order, courier, delivery.paymentMode) : "";

    return NextResponse.json({ ok: true, delivery, ticket });
  }

  // La ficha de una asignación que ya existe, para volver a abrir la hoja sin
  // reasignar. Es de solo lectura: no escribe ni manda nada.
  if (action === "ticket") {
    const order = await getOrderForDelivery(orderId);
    const delivery = (await deliveriesByOrder([orderId])).get(orderId);
    if (!order || !delivery) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const courier = delivery.courierId ? await getCourier(delivery.courierId) : null;
    if (!courier) {
      // Al repartidor lo borraron de la libreta después de asignar: el pedido
      // conserva su nombre, pero ya no hay teléfono al que escribirle.
      return NextResponse.json({ ok: true, ticket: "", courierGone: true });
    }

    return NextResponse.json({
      ok: true,
      ticket: dispatchTicket(order, courier, delivery.paymentMode),
    });
  }

  if (action === "vehicle") {
    const code = typeof body?.vehicleCode === "string" ? body.vehicleCode : null;
    const delivery = await setDeliveryVehicle(orderId, code);
    if (!delivery) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, delivery });
  }

  if (action === "notify") {
    const courierId = Number(body?.courierId);
    const courier = Number.isInteger(courierId) ? await getCourier(courierId) : null;
    const order = await getOrderForDelivery(orderId);
    if (!courier || !order) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // A una agencia el sistema no le escribe: el restaurante la maneja desde
    // su propio WhatsApp (ADR-12). Se devuelve la ficha para el atajo.
    if (courier.kind === "agency") {
      return NextResponse.json({
        ok: true,
        result: { sent: false, reason: "failed" },
        ticket: dispatchTicket(order, courier, courier.paymentMode),
      });
    }

    const driverUrl = env.courierTokenSecret
      ? `${env.portalUrl || new URL(request.url).origin}/repartidor?t=${createCourierToken(
          courier.id,
          env.courierTokenSecret,
        )}`
      : undefined;

    const text = courierBrief(order, courier, driverUrl);
    const answer = await askBot("/api/internal/notify", { phone: courier.phone, text });

    if (answer === null) {
      return NextResponse.json({ ok: true, result: { sent: false, reason: "no_bot" }, ticket: text });
    }

    if (!answer.ok) {
      const reason =
        answer.reason === "window_closed" || answer.reason === "bot_inactive" ? answer.reason : "failed";
      return NextResponse.json({ ok: true, result: { sent: false, reason }, ticket: text });
    }

    await markDeliveryNotified(orderId);
    return NextResponse.json({ ok: true, result: { sent: true }, ticket: text });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
