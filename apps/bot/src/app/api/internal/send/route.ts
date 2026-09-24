import { NextResponse } from "next/server";

import { getConversationByPhone, recordMessage, setBotPaused } from "@/db/queries/conversation";
import { env } from "@/env";
import { sendText } from "@/services/whatsapp/client";

/**
 * El portal manda un mensaje al cliente (Fase 5, RF-33).
 *
 * Lo usa el agente cuando responde desde la bandeja. Protegido con
 * `INTERNAL_SECRET`, igual que `menu-order`: un endpoint abierto que dispara
 * mensajes de WhatsApp en nombre del restaurante no puede quedar público.
 *
 * El orden importa: PRIMERO se pausa el bot, DESPUÉS se envía. Al revés, un
 * fallo entre los dos pasos deja al cliente con la respuesta de la persona y
 * el bot contestándole encima. Se deja pausado aunque el envío falle — un
 * agente que intentó tomar la conversación no debería encontrarse al bot
 * respondiendo por él un segundo después.
 *
 * `sendText` (el único camino de salida, RN-05) ya comprueba `BOT_ACTIVE` y la
 * ventana de 24 h antes de intentar nada.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.internalSecret}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { phone?: unknown; text?: unknown }
    | null;

  const phone = typeof body?.phone === "string" ? body.phone : null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!phone || !text) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const conversation = await getConversationByPhone(phone);
  if (!conversation) {
    return NextResponse.json({ ok: false, reason: "no_conversation" }, { status: 404 });
  }

  await setBotPaused(conversation.id, true);

  const result = await sendText(phone, text);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 502 });
  }

  const message = await recordMessage(conversation.id, "agent", "text", text);

  return NextResponse.json({ ok: true, message });
}
