import { NextResponse } from "next/server";

import { isOpenNow, isWindowOpen, verifyMenuToken } from "@sistema/shared";

import { getConversationByPhone, recordMessage } from "@/db/queries/conversation";
import { findOrderByCode } from "@/db/queries/orders";
import { env } from "@/env";

import { deliverReply } from "@/bot/orchestrator";
import { startOrder } from "@/bot/engine";
import { inboxMeta } from "@/bot/types";

/**
 * El menú avisa que el cliente envió un pedido (RF-26).
 *
 * Protegido con `INTERNAL_SECRET`: un endpoint abierto que dispara mensajes de
 * WhatsApp en nombre del restaurante no puede quedar público.
 *
 * El TOKEN se vuelve a verificar ACÁ, no se confía en lo que diga el menú
 * (ADR-05): el menú solo lo propaga, el bot es quien decide de qué teléfono es
 * el pedido.
 *
 * Cuatro compuertas antes de canjear, en orden — canjear es de un solo uso, y
 * quemar el código sin poder avisarle al cliente lo deja sin pedido y sin
 * reintento automático:
 *
 *  1. Que el pedido exista.
 *  2. Que el token sea válido (si no, el menú ya cayó al modo anónimo y el
 *     cliente manda su `#PEDIDO` a mano — RF-27, este endpoint no interviene).
 *  3. Que el negocio esté abierto, el asistente no esté pausado en esa
 *     conversación, y la ventana de 24 h esté abierta — igual que cualquier
 *     mensaje entrante, solo que acá no hay un mensaje entrante que la
 *     reabra sola.
 *  4. Que el canje salga bien (RN-01).
 *
 * Si cualquiera falla, se responde `ok: false` con el motivo y el menú cae al
 * respaldo manual — ese camino nunca se toca.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.internalSecret}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { code?: string; token?: string | null }
    | null;

  if (!body?.code) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const order = await findOrderByCode(body.code);
  if (!order) {
    return NextResponse.json({ ok: false, reason: "order_not_found" }, { status: 404 });
  }

  const payload = verifyMenuToken(body.token, env.menuTokenSecret);
  if (!payload) {
    return NextResponse.json({ ok: false, reason: "invalid_token" });
  }

  const conversation = await getConversationByPhone(payload.phone);
  if (!conversation) {
    return NextResponse.json({ ok: false, reason: "no_conversation" });
  }

  if (!isOpenNow()) {
    return NextResponse.json({ ok: false, reason: "out_of_hours" });
  }

  if (conversation.botPaused) {
    return NextResponse.json({ ok: false, reason: "paused" });
  }

  if (!isWindowOpen(conversation.lastInboundAt)) {
    return NextResponse.json({ ok: false, reason: "window_closed" });
  }

  const reply = await startOrder(conversation, order);
  await recordMessage(conversation.id, "bot", "text", reply.text, {
    meta: inboxMeta(reply),
  });

  const result = await deliverReply(payload.phone, reply);
  if (!result.ok) {
    console.warn("[menu-order] el pedido se canjeó pero no se pudo avisar:", result);
  }

  return NextResponse.json({ ok: result.ok });
}
