import { NextResponse } from "next/server";

import {
  BUSINESS,
  buildOrderLines,
  generateOrderCode,
  isPaymentMethod,
  parseRawLines,
  verifyMenuToken,
} from "@sistema/shared";
import { db, getCatalog, getPromotions, orderItems, orders } from "@sistema/shared/db";

import { env } from "@/env";

/**
 * Crear el pedido que armó el cliente en el menú (RF-24, RF-26).
 *
 * Dos reglas duras:
 *
 * 1. Los PRECIOS SE RECALCULAN acá contra la base (RN-02). Lo que manda el
 *    navegador son referencias (SKU, IDs de opción, cantidad), nunca cifras:
 *    un carrito manipulado puede elegir productos, jamás inventar lo que
 *    cuestan.
 * 2. El TELÉFONO sale del token firmado del link (`?t=`), verificado ACÁ, no
 *    de nada que mande el navegador. Sin token válido, el pedido queda sin
 *    dueño y el cliente manda su `#PEDIDO` a mano (RF-27, ADR-05).
 *
 * El pedido se crea `draft` y sin canjear siempre — el candado (ADR-02) exige
 * que solo el bot lo canjee, nunca este endpoint. Después de crearlo, se
 * avisa a `apps/bot` (`POST /api/internal/menu-order`) para que el pedido
 * vuelva solo a WhatsApp; si esa llamada falla o no hay token, el pedido
 * sigue existiendo y el cliente puede confirmarlo a mano.
 */

type RequestBody = {
  items?: unknown;
  token?: string | null;
  customerName?: unknown;
  address?: unknown;
  paymentMethod?: unknown;
};

const MAX_TEXT = 300;

/** Recorta y limpia un texto libre del cliente. `null` si quedó vacío. */
function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, MAX_TEXT);
  return clean.length > 0 ? clean : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const rawItems = parseRawLines(body?.items);

  if (rawItems.length === 0) {
    return NextResponse.json({ error: "carrito vacío" }, { status: 400 });
  }

  // Dirección y pago los elige el cliente en el menú (no por chat). Se validan
  // acá igual que los productos: lo que llega del navegador nunca se guarda
  // tal cual.
  const customerName = cleanText(body?.customerName);
  const address = cleanText(body?.address);
  const paymentMethod = isPaymentMethod(body?.paymentMethod) ? body.paymentMethod : null;

  if (!address || !paymentMethod) {
    return NextResponse.json(
      { error: "falta la dirección o el método de pago" },
      { status: 400 },
    );
  }

  const [catalog, promotions] = await Promise.all([getCatalog(), getPromotions()]);

  // `buildOrderLines` resuelve los precios contra la base (RN-02) y devuelve
  // aparte lo que no se pudo cobrar. Acá esas listas se **ignoran** a
  // propósito: el cliente está mirando la pantalla y ve que el producto
  // agotado desapareció de su carrito. El endpoint de voz hace lo contrario
  // (ahí nadie está mirando nada), y por eso la decisión es del llamador.
  const { lines: itemsToInsert, subtotal } = buildOrderLines(catalog, promotions, rawItems);

  if (itemsToInsert.length === 0) {
    return NextResponse.json(
      { error: "ninguno de los productos sigue disponible" },
      { status: 400 },
    );
  }

  const deliveryFee = BUSINESS.deliveryFee;
  const total = subtotal + deliveryFee;

  const code = generateOrderCode();
  const [order] = await db
    .insert(orders)
    .values({ code, subtotal, deliveryFee, total, customerName, address, paymentMethod })
    .returning();

  await db
    .insert(orderItems)
    .values(itemsToInsert.map((item) => ({ ...item, orderId: order.id })));

  const payload = verifyMenuToken(body?.token ?? null, env.menuTokenSecret);
  const delivered = payload ? await notifyBot(code, body?.token ?? null) : false;

  // El número sale del servidor, no de una variable del navegador: así hay UN
  // solo sitio donde vive cuál es el número del bot y no dos que se puedan
  // desincronizar sin que nadie lo note hasta que un cliente le escriba al
  // número equivocado.
  return NextResponse.json(
    { code, delivered, whatsappNumber: BUSINESS.whatsappNumber },
    { status: 201 },
  );
}

/** Nunca lanza: si el bot no responde, el pedido igual quedó guardado y el
 *  cliente cae al respaldo manual (RF-27) — el mismo principio de
 *  degradación con gracia que rige el resto del sistema. */
async function notifyBot(code: string, token: string | null): Promise<boolean> {
  try {
    const response = await fetch(`${env.botUrl}/api/internal/menu-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.internalSecret}`,
      },
      body: JSON.stringify({ code, token }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { ok?: boolean };
    return data.ok === true;
  } catch (error) {
    console.error("[api/orders] no se pudo avisar al bot:", error);
    return false;
  }
}
