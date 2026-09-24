import { NextResponse } from "next/server";

import { getInboxConversations } from "@/db/inbox";

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
 * **Todavía no hay POST.** Pausar, reactivar y responder desde acá siguen
 * marcados `TODO(backend)` en `apps/portal/src/lib/portal-api.ts` — responder
 * tiene que salir por `apps/bot` (`POST /api/internal/send`, RN-05: un solo
 * camino de salida), que además debe comprobar la ventana de 24 h antes de
 * intentar nada.
 */

export async function GET() {
  const conversations = await getInboxConversations();
  return NextResponse.json({ conversations });
}
