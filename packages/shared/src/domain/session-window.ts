/**
 * La ventana de servicio de 24 horas de WhatsApp.
 *
 * **Esta es la regla de Meta que más sorprende a quien viene de un chat
 * propio.** Solo se pueden enviar mensajes libres dentro de las 24 horas
 * siguientes al último mensaje del cliente. Pasado ese plazo, la Cloud API
 * rechaza cualquier texto que no sea una **plantilla aprobada** por Meta.
 *
 * Consecuencias prácticas que atraviesan todo el sistema:
 *
 * - El avisó de "tu pedido va en camino" puede llegar tarde y encontrarse la
 *   ventana cerrada. Por eso los avisos van a un outbox con reintentos y no
 *   se envían directo (ver la tabla `notifications`).
 * - El agente del portal tampoco puede escribirle a un cliente en frío. El
 *   portal se lo tiene que decir, no dejarlo escribir y fallar en silencio.
 * - El cliente siempre inicia. Ningún flujo puede depender de que nosotros
 *   escribamos primero.
 */

const WINDOW_HOURS = 24;
/** Margen para no intentar un envío que va a caducar mientras viaja. */
const SAFETY_MINUTES = 5;

export function isWindowOpen(
  lastInboundAt: Date | null | undefined,
  now: Date = new Date(),
) {
  if (!lastInboundAt) return false;

  const elapsedMs = now.getTime() - lastInboundAt.getTime();
  const limitMs = (WINDOW_HOURS * 60 - SAFETY_MINUTES) * 60 * 1000;
  return elapsedMs < limitMs;
}

/** Cuánto queda, para mostrarlo en el portal. */
export function windowRemaining(
  lastInboundAt: Date | null | undefined,
  now: Date = new Date(),
): { open: boolean; minutesLeft: number } {
  if (!lastInboundAt) return { open: false, minutesLeft: 0 };

  const elapsedMin = (now.getTime() - lastInboundAt.getTime()) / 60000;
  const minutesLeft = Math.max(
    0,
    Math.floor(WINDOW_HOURS * 60 - SAFETY_MINUTES - elapsedMin),
  );

  return { open: minutesLeft > 0, minutesLeft };
}

export function formatWindowRemaining(minutesLeft: number) {
  if (minutesLeft <= 0) return "cerrada";
  if (minutesLeft < 60) return `${minutesLeft} min`;
  return `${Math.floor(minutesLeft / 60)} h`;
}
