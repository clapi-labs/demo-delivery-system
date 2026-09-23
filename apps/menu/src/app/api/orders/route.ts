import { NextResponse } from "next/server";

import {
  BUSINESS,
  findBySku,
  generateOrderCode,
  resolveOptions,
  unitPriceWithOptions,
  verifyMenuToken,
} from "@sistema/shared";
import { db, getCatalog, orderItems, orders, type SelectedOption } from "@sistema/shared/db";

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

type RequestItem = { sku?: unknown; optionIds?: unknown; quantity?: unknown };
type RequestBody = { items?: RequestItem[]; token?: string | null };

const MAX_LINES = 20;
const MAX_QUANTITY = 20;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  if (rawItems.length === 0) {
    return NextResponse.json({ error: "carrito vacío" }, { status: 400 });
  }

  const catalog = await getCatalog();

  const lines: {
    product: ReturnType<typeof findBySku>;
    optionIds: number[];
    quantity: number;
  }[] = [];

  for (const raw of rawItems.slice(0, MAX_LINES)) {
    if (typeof raw.sku !== "string") continue;
    const quantity = Math.floor(Number(raw.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY) continue;

    const product = findBySku(catalog, raw.sku);
    if (!product || !product.available) continue;

    const optionIds = Array.isArray(raw.optionIds)
      ? raw.optionIds.filter((id): id is number => typeof id === "number")
      : [];

    lines.push({ product, optionIds, quantity });
  }

  if (lines.length === 0) {
    return NextResponse.json(
      { error: "ninguno de los productos sigue disponible" },
      { status: 400 },
    );
  }

  const itemsToInsert = lines.map(({ product, optionIds, quantity }) => {
    const unitPrice = unitPriceWithOptions(product!, optionIds);
    const selectedOptions: SelectedOption[] = resolveOptions(product!, optionIds).map(
      (o) => ({ group: o.groupName, name: o.name, priceDelta: o.priceDelta }),
    );
    return {
      productId: product!.id,
      nameSnapshot: product!.name,
      unitPrice,
      quantity,
      selectedOptions,
      lineTotal: unitPrice * quantity,
    };
  });

  const subtotal = itemsToInsert.reduce((sum, i) => sum + i.lineTotal, 0);
  const deliveryFee = BUSINESS.deliveryFee;
  const total = subtotal + deliveryFee;

  const code = generateOrderCode();
  const [order] = await db
    .insert(orders)
    .values({ code, subtotal, deliveryFee, total })
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
