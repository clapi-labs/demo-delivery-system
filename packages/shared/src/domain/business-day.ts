import { BUSINESS } from "../config/business-info";

/**
 * "Hoy" para el restaurante, no para el servidor.
 *
 * Importa más de lo que parece: el portal corre en Vercel (UTC) y el negocio
 * cierra a medianoche en Bogotá. Sin esto, el arqueo del turno de la noche se
 * parte en dos días —lo de después de 7 p.m. cuenta como "mañana"— y los
 * números no le cuadran a nadie.
 *
 * No se asume UTC-5 fijo: se calcula el desplazamiento real de la zona para
 * ese instante, así que sirve igual en un país con horario de verano.
 */

function offsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );

  return asUtc - date.getTime();
}

/** La medianoche del día que el restaurante está viviendo ahora. */
export function startOfBusinessDay(now: Date = new Date(), timeZone = BUSINESS.timezone) {
  const offset = offsetMs(now, timeZone);
  const local = new Date(now.getTime() + offset);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}

/** El rango [medianoche de hoy, medianoche de mañana) del negocio. */
export function businessDayRange(now: Date = new Date(), timeZone = BUSINESS.timezone) {
  const since = startOfBusinessDay(now, timeZone);
  const until = startOfBusinessDay(new Date(since.getTime() + 36 * 3600_000), timeZone);
  return { since, until };
}
