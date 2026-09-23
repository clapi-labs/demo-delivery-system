import { BUSINESS, isOpenNow } from "@sistema/shared";

/**
 * El estado del servicio, en la hora del NEGOCIO (`BUSINESS.timezone`), no
 * la del navegador de quien mira la carta — si alguien abre el menú desde
 * otro huso, "abre a las 11:00" tiene que seguir siendo la hora de acá.
 *
 * A diferencia del prototipo de diseño, no hay días cerrados: el negocio
 * abre los mismos `opensAt`–`closesAt` todos los días (`BUSINESS_HOURS`
 * dice "Lunes a domingo"), así que esa parte de la lógica no se portó —
 * no hay una decisión tomada todavía sobre cerrar un día fijo.
 */
export type ServiceStatus = { open: boolean; label: string };

function hourInBusinessTz(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS.timezone,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
}

function clock(hour: number) {
  return `${hour}:00`;
}

export function serviceStatus(now: Date = new Date()): ServiceStatus {
  const hour = hourInBusinessTz(now);
  const open = isOpenNow(now);

  if (open) {
    return { open: true, label: `Abierto ahora, cierra a las ${clock(BUSINESS.closesAt)}` };
  }

  if (hour < BUSINESS.opensAt) {
    return { open: false, label: `Abre hoy a las ${clock(BUSINESS.opensAt)}` };
  }

  return { open: false, label: `Cerrado. Abre mañana a las ${clock(BUSINESS.opensAt)}` };
}
