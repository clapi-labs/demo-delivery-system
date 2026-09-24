import { NextResponse } from "next/server";

import { flushOutbox } from "@/bot/outbox";
import { env } from "@/env";

/**
 * El portal pide que se entreguen ya los avisos pendientes (RF-30).
 *
 * Lo llama justo después de encolar un cambio de estado. Existe por una razón
 * muy concreta: en el plan gratuito de Vercel un cron corre **una vez al
 * día**, y un cliente que se entera mañana de que su pedido salió hoy no se
 * entera de nada.
 *
 * Es un disparo, no un segundo camino de salida: hace exactamente el mismo
 * barrido que el cron (`bot/outbox.ts`) y el envío sigue saliendo por
 * `sendText` (RN-05). Si esta llamada falla, el cron lo recoge después — por
 * eso el portal la hace sin esperar la respuesta.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.internalSecret}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const result = await flushOutbox();
  return NextResponse.json({ ok: true, ...result });
}
