import { after } from "next/server";

import { handleIncoming } from "@/bot/orchestrator";
import { markProcessedIfNew } from "@/db/queries/idempotency";
import { env } from "@/env";
import { extractIncomingMessages } from "@/services/whatsapp/normalize";
import type { WaWebhookPayload } from "@/services/whatsapp/types";
import {
  handleVerification,
  isValidSignature,
} from "@/services/whatsapp/verify";

export const dynamic = "force-dynamic";

/** Apretón de manos al configurar el webhook en el panel de Meta. */
export async function GET(request: Request) {
  const result = handleVerification(
    new URL(request.url),
    env.whatsapp.verifyToken,
  );

  if (!result.ok) {
    return new Response("Forbidden", { status: 403 });
  }

  // Texto plano, no JSON: Meta compara el cuerpo carácter por carácter.
  return new Response(result.challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * Entrega de mensajes.
 *
 * **Responder 200 rápido es un requisito, no una optimización.** Meta espera
 * pocos segundos; si no llega el acuse, reintenta la entrega — y el mismo
 * mensaje vuelve a llegar. De ahí las dos reglas que gobiernan este archivo:
 *
 * 1. Se acusa **siempre 200**, incluso si el procesamiento falla. Un 500 no
 *    hace que Meta lo intente mejor: hace que lo intente otra vez.
 * 2. Todo procesamiento pasa por `processed_messages` antes de hacer nada,
 *    para que un reintento no le conteste dos veces al cliente.
 *
 * Esta ruta solo entiende el protocolo de Meta (firma, formato del payload,
 * idempotencia). Qué contestarle al cliente es responsabilidad del
 * orquestador (`bot/orchestrator.ts`) — la ruta no sabe nada de menús,
 * pedidos ni horarios.
 *
 * **El acuse sale ANTES de procesar**, con `after()` de Next.js: procesar
 * implica llamar a OpenAI y a la Graph API, y esperar eso antes de contestar
 * es exactamente lo que hace que Meta reintente por lentitud, no por error.
 */
export async function POST(request: Request) {
  // El cuerpo CRUDO, sin parsear: la firma se calcula sobre estos bytes
  // exactos. Parsear y volver a serializar rompe la verificación.
  const rawBody = await request.text();

  if (
    !isValidSignature(
      rawBody,
      request.headers.get("x-hub-signature-256"),
      env.whatsapp.appSecret,
    )
  ) {
    // 403 y punto: esto no vino de Meta.
    return new Response("Invalid signature", { status: 403 });
  }

  let payload: WaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("OK", { status: 200 });
  }

  after(async () => {
    try {
      await processWebhook(payload);
    } catch (error) {
      // Se registra; el acuse ya salió, así que no hay a quién avisarle más
      // que al log (ver la regla 1 de arriba).
      console.error("[webhook] fallo procesando la entrega:", error);
    }
  });

  return new Response("OK", { status: 200 });
}

async function processWebhook(payload: WaWebhookPayload) {
  const incoming = extractIncomingMessages(payload);

  for (const message of incoming) {
    try {
      const isNew = await markProcessedIfNew(message.waMessageId);
      if (!isNew) continue; // reintento de Meta: ya se procesó

      await handleIncoming(message);
    } catch (error) {
      // Un mensaje que falla no puede tumbar a los demás de la misma entrega.
      console.error("[webhook] fallo procesando un mensaje:", error);
    }
  }
}
