import type { CourierKind, CourierPayment } from "@sistema/shared";

/**
 * Repartidores del lado del navegador (RF-49 a RF-54).
 *
 * Como `lib/orders.ts`, **no importa nada de `@sistema/shared/db`**: lo usan
 * componentes de cliente, y cualquier cosa de `db/` arrastra el driver de
 * Postgres al bundle (ver CLAUDE.md). Los tipos y los textos sí salen de
 * `@sistema/shared`, que es puro dominio.
 */

export type { CourierKind, CourierPayment };

/** Lo que devuelve `GET /api/couriers` por cada uno. */
export type Courier = {
  id: number;
  kind: CourierKind;
  name: string;
  phone: string;
  paymentMode: CourierPayment | null;
  notes: string | null;
  active: boolean;
  sortOrder: number;
  /**
   * El link de su pantalla, ya firmado. Solo para los propios: una agencia no
   * marca entregas, y `null` también cuando falta el secreto que lo firma (el
   * portal lo dice en pantalla en vez de mostrar un link roto).
   */
  driverUrl: string | null;
};

/** Una fila del cierre de turno. */
export type Settlement = {
  courierId: number | null;
  courierName: string;
  kind: CourierKind;
  delivered: number;
  pending: number;
  total: number;
  cash: number;
  account: number;
};

/** Cómo salió el intento de avisarle por WhatsApp a un domiciliario propio. */
export type NotifyResult =
  | { sent: true }
  | { sent: false; reason: "window_closed" | "bot_inactive" | "no_bot" | "failed" };

/**
 * Por qué no se pudo avisar, en palabras del restaurante.
 *
 * `window_closed` es el caso que de verdad ocurre y no es un error: Meta solo
 * deja escribirle a alguien que escribió en las últimas 24 horas. Para un
 * domiciliario que nunca le ha escrito al bot, el camino es el mismo botón de
 * WhatsApp que se usa con las agencias.
 */
export const NOTIFY_REASON: Record<Exclude<NotifyResult, { sent: true }>["reason"], string> = {
  window_closed:
    "WhatsApp no deja escribirle primero: pídele que le mande cualquier mensaje al bot y vuelve a intentar. Mientras tanto, mándale la ficha desde tu WhatsApp.",
  bot_inactive: "El asistente está apagado (BOT_ACTIVE), así que no salió ningún mensaje.",
  no_bot: "Falta configurar la conexión con el bot (BOT_URL / INTERNAL_SECRET).",
  failed: "WhatsApp rechazó el mensaje. Mándale la ficha desde tu WhatsApp.",
};

export function courierGroups(couriers: Courier[]) {
  return {
    internal: couriers.filter((c) => c.kind === "internal"),
    agency: couriers.filter((c) => c.kind === "agency"),
  };
}
