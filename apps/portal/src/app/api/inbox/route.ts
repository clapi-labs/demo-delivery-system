import { NextResponse } from "next/server";

import {
  getConversationPhone,
  getInboxConversations,
  recordSystemMessage,
  sanitizeMeta,
  setConversationPaused,
} from "@/db/inbox";

export const dynamic = "force-dynamic";

/**
 * La bandeja de conversaciones (Fase 5).
 *
 * Esto REEMPLAZA a Chatwoot. Los mensajes ya están en nuestra base porque el
 * bot los escribe al recibirlos y al responder, así que la bandeja no espeja
 * nada: lee la fuente.
 *
 * GET: lista de conversaciones + su hilo completo.
 *
 * POST: tres acciones (`action`), todas en la misma ruta porque las tres
 * mutan la misma conversación:
 *  - `pause`/`resume`: solo tocan `conversations` acá mismo — no hay envío a
 *    WhatsApp de por medio, así que RN-05 no aplica.
 *  - `send`: SÍ manda un mensaje al cliente, y eso tiene que salir por
 *    `apps/bot` (`POST /api/internal/send`), el único camino de salida. Este
 *    endpoint solo resuelve el teléfono y reenvía la llamada con el secreto
 *    compartido — la ventana de 24 h y `BOT_ACTIVE` los comprueba el bot.
 */

function botUrl(): string {
  const value = process.env.BOT_URL ?? "";
  return (/^https?:\/\//i.test(value) ? value : `https://${value}`).replace(/\/+$/, "");
}

export async function GET() {
  const conversations = await getInboxConversations();
  return NextResponse.json({ conversations });
}

type Body = { action?: unknown; conversationId?: unknown; text?: unknown };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const conversationId = Number(body?.conversationId);

  if (!Number.isInteger(conversationId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (body?.action === "pause" || body?.action === "resume") {
    const paused = body.action === "pause";
    await setConversationPaused(conversationId, paused);
    await recordSystemMessage(
      conversationId,
      paused ? "Un agente pausó al bot y tomó la conversación." : "El bot retomó la conversación.",
    );
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "send") {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "bad_request" }, { status: 400 });

    const phone = await getConversationPhone(conversationId);
    if (!phone) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const secret = process.env.INTERNAL_SECRET;
    if (!process.env.BOT_URL || !secret) {
      console.error("[api/inbox] falta BOT_URL o INTERNAL_SECRET en el entorno del portal");
      return NextResponse.json({ error: "misconfigured" }, { status: 500 });
    }

    const res = await fetch(`${botUrl()}/api/internal/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ phone, text }),
    });

    const data = (await res.json().catch(() => null)) as
      | {
          ok?: boolean;
          reason?: string;
          message?: { id: number; role: string; kind: string; text: string; meta: unknown; createdAt: string };
        }
      | null;

    if (!res.ok || !data?.ok || !data.message) {
      return NextResponse.json({ error: data?.reason ?? "send_failed" }, { status: 502 });
    }

    const saved = data.message;
    return NextResponse.json({
      ok: true,
      message: {
        id: String(saved.id),
        role: saved.role,
        kind: saved.kind,
        text: saved.text,
        createdAt: saved.createdAt,
        meta: sanitizeMeta(saved.meta),
      },
    });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
