import { NextResponse } from "next/server";

import { flushOutbox } from "@/bot/outbox";
import { env } from "@/env";

export const dynamic = "force-dynamic";

/**
 * Barrido del outbox de avisos (RF-31).
 *
 * Lo dispara Vercel Cron (ver `vercel.json`). La lógica vive en
 * `bot/outbox.ts` porque el portal también la dispara al instante desde
 * `/api/internal/outbox` — el cron no es un camino distinto, es la red de
 * seguridad para lo que ese disparo no alcanzó a entregar.
 *
 * Protegido igual que los demás endpoints internos: un barrido abierto no
 * filtra datos, pero sí deja que cualquiera fuerce el reenvío de mensajes en
 * nombre del restaurante. Vercel manda `CRON_SECRET` si está configurado; se
 * acepta también `INTERNAL_SECRET` para poder probarlo a mano sin inventar
 * un segundo secreto en el entorno local.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  const allowed =
    (cronSecret && auth === `Bearer ${cronSecret}`) || auth === `Bearer ${env.internalSecret}`;

  if (!allowed) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const result = await flushOutbox();
  return NextResponse.json({ ok: true, ...result });
}
