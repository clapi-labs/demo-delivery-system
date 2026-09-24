import {
  markNotificationDelivered,
  markNotificationFailed,
  pendingNotifications,
} from "@sistema/shared/db";

import { recordMessage } from "@/db/queries/conversation";
import { sendText } from "@/services/whatsapp/client";

/**
 * Barrido del outbox de avisos (RF-31).
 *
 * Toma lo que el portal encoló al cambiar el estado de un pedido y lo manda
 * por WhatsApp. Lo llaman dos sitios:
 *
 *  - `/api/cron/outbox`, que dispara Vercel Cron — la red de seguridad.
 *  - `/api/internal/outbox`, que el portal llama al instante después de
 *    encolar, para que en una demo el aviso llegue en segundos y no cuando
 *    pase el cron.
 *
 * Los dos hacen lo mismo; el cron no es un camino distinto, es el mismo
 * barrido llamado por otro reloj. Por eso vive acá y no en una de las rutas.
 *
 * `sendText` ya comprueba `BOT_ACTIVE` y la ventana de 24 h, así que este
 * barrido no decide nada sobre envíos: solo cuenta intentos.
 *
 * **No se manda nada fuera de la ventana de 24 h, y eso además es lo que hace
 * que esto no cueste dinero:** Meta cobra las conversaciones que inicia el
 * negocio con plantilla, no los mensajes de servicio dentro de la ventana. Un
 * cliente que acaba de pedir siempre está dentro.
 */
export async function flushOutbox(limit = 20) {
  const pending = await pendingNotifications(limit);
  let sent = 0;
  let failed = 0;

  for (const item of pending) {
    const result = await sendText(item.phone, item.text);

    if (!result.ok) {
      failed += 1;
      await markNotificationFailed(item.id, item.attempts, result.reason);
      continue;
    }

    await markNotificationDelivered(item.id);
    // Queda en el hilo de la bandeja: quien abra la conversación después
    // tiene que ver lo mismo que vio el cliente, no un chat donde el sistema
    // escribió por detrás.
    await recordMessage(item.conversationId, "bot", "text", item.text, {
      meta: { source: "outbox" },
    });
    sent += 1;
  }

  return { pending: pending.length, sent, failed };
}
