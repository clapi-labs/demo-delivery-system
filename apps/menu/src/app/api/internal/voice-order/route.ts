import { NextResponse } from "next/server";

import {
  BUSINESS,
  buildOrderLines,
  generateOrderCode,
  isPaymentMethod,
  parseRawLines,
  rejectionMessage,
  voiceOrderMessage,
} from "@sistema/shared";
import {
  db,
  enqueueOrderNotification,
  getCatalog,
  getPromotions,
  orderItems,
  orders,
} from "@sistema/shared/db";
import { eq } from "drizzle-orm";

import { env } from "@/env";

/**
 * Crear el pedido que cerró el agente de voz (RF-57, ADR-13).
 *
 * Es **la única excepción a ADR-02** —un pedido no puede nacer de una
 * conversación— y está acotada a propósito:
 *
 * 1. **El modelo no arma el pedido, solo lo dicta.** Lo que llega son SKUs,
 *    ids de opción y cantidades. El precio, las promociones y el total los
 *    calcula `buildOrderLines` contra la base (RN-02, RN-14), con la misma
 *    función que usa el carrito del menú. Un agente que se equivoque puede
 *    pedir el producto errado; no puede inventar lo que cuesta.
 * 2. **El total que se le dice al cliente es el de esta respuesta**, no el que
 *    sumó el agente. Si una promoción se venció en medio de la llamada, el
 *    número que queda guardado y el que se dice en voz alta son el mismo.
 * 3. **Queda auditable:** `source = "call"` y `sourceRef` con el id de la
 *    llamada. Se puede saber cuál pedido no nació del menú, y cuál llamada lo
 *    creó.
 *
 * Entra como `pending` y no como `draft`: en una llamada no hay nada que
 * canjear. El código de un solo uso existe para que el pedido **vuelva** del
 * navegador al chat; acá el cliente ya confirmó hablando, y el canje solo
 * dejaría la comanda esperando a alguien que nunca va a escribir.
 *
 * Y a diferencia del menú, acá **un producto agotado hace fallar el pedido
 * entero** (422). En el menú se descarta y se sigue porque el cliente está
 * mirando la pantalla; en una llamada, un cliente que pidió tres cosas y
 * recibe dos no se enteró de nada. El agente necesita la lista para decírselo.
 */

type RequestBody = {
  callId?: unknown;
  customerName?: unknown;
  phone?: unknown;
  address?: unknown;
  addressNotes?: unknown;
  paymentMethod?: unknown;
  items?: unknown;
};

const MAX_TEXT = 300;

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, MAX_TEXT);
  return clean.length > 0 ? clean : null;
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.internalSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;

  // `callId` es obligatorio: es lo único que hace este endpoint idempotente, y
  // sin él dos invocaciones del modelo crean dos comandas en la parrilla.
  const callId = cleanText(body?.callId);
  if (!callId) {
    return NextResponse.json({ error: "falta callId" }, { status: 400 });
  }

  const rawItems = parseRawLines(body?.items);
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "pedido vacío" }, { status: 400 });
  }

  const address = cleanText(body?.address);
  if (!address) {
    return NextResponse.json({ error: "falta la dirección" }, { status: 400 });
  }

  const customerName = cleanText(body?.customerName);
  const addressNotes = cleanText(body?.addressNotes);
  const paymentMethod = isPaymentMethod(body?.paymentMethod) ? body.paymentMethod : null;

  // El teléfono puede ir vacío: una llamada web no trae número. El agente lo
  // pregunta, pero si el cliente no lo quiere dar el pedido se toma igual — la
  // comanda queda completa, solo sin aviso por WhatsApp.
  const phone =
    typeof body?.phone === "string" ? body.phone.replace(/\D/g, "").slice(0, 20) : "";

  // Si esta llamada ya creó un pedido, se devuelve ese mismo. El modelo invoca
  // `confirm_order` dos veces de vez en cuando: eso es un reintento, no un
  // pedido nuevo.
  const yaExiste = await findByCallId(callId);
  if (yaExiste) return NextResponse.json(yaExiste, { status: 200 });

  const [catalog, promotions] = await Promise.all([getCatalog(), getPromotions()]);

  const built = buildOrderLines(catalog, promotions, rawItems, {
    requireOptionGroups: true,
  });

  // Nada se crea a medias: si algo no se pudo cobrar, no hay pedido y el agente
  // se lo dice al cliente con la lista en la mano.
  const rechazo = rejectionMessage(built);
  if (rechazo || built.lines.length === 0) {
    return NextResponse.json(
      {
        error: "no se pudo armar el pedido",
        reason: rechazo ?? "ningún producto válido",
        unavailable: built.unavailable,
        unknown: built.unknown,
        missingRequired: built.missingRequired,
      },
      { status: 422 },
    );
  }

  const subtotal = built.subtotal;
  const deliveryFee = BUSINESS.deliveryFee;
  const total = subtotal + deliveryFee;
  const code = generateOrderCode();
  const now = new Date();

  let order: typeof orders.$inferSelect;
  try {
    [order] = await db
      .insert(orders)
      .values({
        code,
        phone: phone.length > 0 ? phone : null,
        status: "pending",
        source: "call",
        sourceRef: callId,
        // Explícito y no `null`: este pedido no está a medias esperando un
        // canje. El cliente ya lo confirmó, solo que hablando.
        redeemedAt: now,
        customerName,
        address,
        addressNotes,
        paymentMethod,
        subtotal,
        deliveryFee,
        total,
      })
      .returning();
  } catch (error) {
    // La carrera que el `select` de arriba no alcanza a cubrir: dos
    // `confirm_order` en paralelo. Lo garantiza `orders_source_ref_idx`, no un
    // `if` — y acá se traduce a la misma respuesta idempotente.
    const existente = await findByCallId(callId);
    if (existente) return NextResponse.json(existente, { status: 200 });
    throw error;
  }

  await db
    .insert(orderItems)
    .values(built.lines.map((line) => ({ ...line, orderId: order.id })));

  // El aviso es un encargo, no una garantía: si ese número nunca le escribió al
  // bot, la ventana de 24 h está cerrada y esto devuelve `false`. El pedido
  // queda igual de completo en el portal.
  const notified = await enqueueOrderNotification(
    order.id,
    voiceOrderMessage(code, total, address),
  );

  return NextResponse.json(
    {
      code,
      subtotal,
      deliveryFee,
      total,
      eta: BUSINESS.deliveryTime,
      notified,
      duplicated: false,
    },
    { status: 201 },
  );
}

/** El pedido que ya creó esta llamada, con la misma forma de la respuesta
 *  nueva para que el agente no tenga que distinguir los dos casos. */
async function findByCallId(callId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.sourceRef, callId))
    .limit(1);
  if (!order) return null;

  return {
    code: order.code,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    eta: BUSINESS.deliveryTime,
    notified: false,
    duplicated: true,
  };
}
