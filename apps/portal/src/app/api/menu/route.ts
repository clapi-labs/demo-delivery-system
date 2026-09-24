import { NextResponse } from "next/server";

import {
  deletePromotion,
  getPromotions,
  savePromotion,
  setPromotionActive,
} from "@sistema/shared/db";
import type { Promotion } from "@sistema/shared";

import { getPortalMenu, setProductAvailable } from "@/db/menu";

export const dynamic = "force-dynamic";

/**
 * El Menú que administra el restaurante (Fase 5).
 *
 * GET: el catálogo real de Neon —el mismo que ve el cliente y consulta el
 * bot— más las promociones.
 *
 * POST: las escrituras que ya están conectadas. Ninguna manda nada por
 * WhatsApp, así que RN-05 no entra acá; se escriben directo, como el cambio de
 * estado de un pedido.
 *  - `available`: marcar un producto agotado o disponible.
 *  - `promotion` / `promotion-active` / `promotion-delete`: las promociones.
 *
 * **Lo que NO está conectado**: crear y editar productos y categorías. No es
 * un olvido — la foto de un producto necesita almacenamiento externo (en
 * Vercel el disco se borra entre invocaciones) y esa decisión sigue abierta en
 * STATUS.md. La interfaz lo dice en pantalla para que nadie edite un precio en
 * una demo creyendo que quedó guardado.
 */

function badRequest() {
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}

export async function GET() {
  const [menu, promotions] = await Promise.all([getPortalMenu(), getPromotions()]);
  return NextResponse.json({ ...menu, promotions });
}

type Body = {
  action?: unknown;
  productId?: unknown;
  available?: unknown;
  promotionId?: unknown;
  active?: unknown;
  promotion?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;

  switch (body?.action) {
    case "available": {
      const productId = Number(body.productId);
      if (!Number.isInteger(productId) || typeof body.available !== "boolean") return badRequest();
      const ok = await setProductAvailable(productId, body.available);
      if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    case "promotion": {
      const promo = parsePromotion(body.promotion);
      if (!promo) return badRequest();
      const saved = await savePromotion(promo);
      return NextResponse.json({ ok: true, promotion: saved });
    }

    case "promotion-active": {
      const promotionId = Number(body.promotionId);
      if (!Number.isInteger(promotionId) || typeof body.active !== "boolean") return badRequest();
      await setPromotionActive(promotionId, body.active);
      return NextResponse.json({ ok: true });
    }

    case "promotion-delete": {
      const promotionId = Number(body.promotionId);
      if (!Number.isInteger(promotionId)) return badRequest();
      await deletePromotion(promotionId);
      return NextResponse.json({ ok: true });
    }

    default:
      return badRequest();
  }
}

/**
 * Valida lo que llega del navegador antes de escribirlo.
 *
 * No es ceremonia: `scope` y `days` van a `jsonb`, que acepta cualquier cosa.
 * Una promoción con un `scope` malformado no revienta al guardarse — revienta
 * después, cuando el bot intente contestar con ella delante de un cliente.
 */
function parsePromotion(raw: unknown): Promotion | null {
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Record<string, unknown>;

  const kind = p.kind;
  if (kind !== "percent" && kind !== "price" && kind !== "2x1") return null;

  const name = typeof p.name === "string" ? p.name.trim() : "";
  if (!name) return null;

  const days = Array.isArray(p.days)
    ? [...new Set(p.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))]
    : [];
  if (days.length === 0) return null;

  const scope = parseScope(p.scope);
  if (!scope) return null;

  const time = (value: unknown) =>
    typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : null;

  return {
    id: Number.isInteger(p.id) ? (p.id as number) : 0,
    name,
    kind,
    value: Number.isFinite(p.value) ? Math.max(0, Math.round(p.value as number)) : 0,
    scope,
    days,
    from: time(p.from),
    to: time(p.to),
    active: p.active !== false,
  };
}

function parseScope(raw: unknown): Promotion["scope"] | null {
  if (typeof raw !== "object" || raw === null) return null;
  const scope = raw as Record<string, unknown>;

  if (scope.type === "all") return { type: "all" };
  if (scope.type !== "category" && scope.type !== "products") return null;

  const ids = Array.isArray(scope.ids)
    ? [...new Set(scope.ids.filter((id): id is number => Number.isInteger(id)))]
    : [];
  if (ids.length === 0) return null;

  return { type: scope.type, ids };
}
