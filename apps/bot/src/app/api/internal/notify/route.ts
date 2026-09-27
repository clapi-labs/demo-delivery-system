import { NextResponse } from "next/server";

import { getConversationByPhone, setBotPaused } from "@/db/queries/conversation";
import { env } from "@/env";
import { sendText } from "@/services/whatsapp/client";

/**
 * Un aviso operativo a alguien que no es cliente: hoy, el domiciliario propio
 * al que se le asigna un pedido (RF-51).
 *
 * Existe aparte de `internal/send` porque ese otro es para **responderle a un
 * cliente**: exige que la conversación ya exista y pausa el bot en ella. Un
 * domiciliario normalmente no tiene conversación, y exigirla haría que el
 * aviso fallara con un 404 sin motivo real.
 *
 * Lo que sí hace, si resulta que ese número ya le había escrito al bot: dejarlo
 * pausado. Un domiciliario que contesta "voy" no puede recibir el menú del
 * restaurante como si fuera a pedir hamburguesas.
 *
 * **La ventana de 24 h manda.** `sendText` la comprueba (RN-05) y devuelve
 * `window_closed` si el domiciliario nunca le escribió al bot. Eso se responde
 * tal cual, sin disfrazarlo de error del servidor: el portal lo traduce y
 * ofrece mandar la ficha desde el WhatsApp del restaurante.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.internalSecret}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { phone?: unknown; text?: unknown }
    | null;

  const phone = typeof body?.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!phone || !text) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const conversation = await getConversationByPhone(phone);
  if (conversation && !conversation.botPaused) {
    await setBotPaused(conversation.id, true);
  }

  const result = await sendText(phone, text);
  if (!result.ok) {
    // 200 con `ok: false`: para el portal no es un fallo del servidor, es una
    // respuesta ("no se pudo, por esto"). Un 502 haría que el navegador lo
    // tratara como caída y perdiera el motivo.
    return NextResponse.json({ ok: false, reason: result.reason });
  }

  return NextResponse.json({ ok: true });
}
