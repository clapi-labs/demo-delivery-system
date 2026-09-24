import { formatPhone, type PaymentMethod } from "@sistema/shared";

/**
 * Pedidos del lado del navegador: tipos, el flujo de estados y cómo se
 * nombran en pantalla.
 *
 * No importa nada de `@sistema/shared/db` a propósito — este módulo lo usan
 * componentes de cliente, y cualquier cosa de `db/` arrastra el driver de
 * Postgres al bundle del navegador (ver CLAUDE.md).
 */

/** Los mismos valores que `OrderStatus` del esquema, sin `draft`: el portal
 *  nunca ve borradores (ver `src/db/orders.ts`). */
export type OrderStatus = "pending" | "preparing" | "sent" | "delivered" | "cancelled";

/** Lo que devuelve `GET /api/orders`: `PortalOrder` de `src/db/orders.ts`
 *  ya serializado (la fecha viaja como texto). */
export type PortalOrder = {
  id: number;
  code: string;
  status: OrderStatus;
  phone: string | null;
  customerName: string | null;
  address: string | null;
  paymentMethod: PaymentMethod | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    options: { group: string; name: string; priceDelta: number }[];
  }[];
};

/** El camino normal. `cancelled` queda fuera: es una salida, no un paso. */
export const ORDER_STATUS_FLOW: OrderStatus[] = ["pending", "preparing", "sent", "delivered"];

/** Los estados que ocupan a la cocina: las tres columnas del tablero. */
export const ACTIVE_STATUSES = ["pending", "preparing", "sent"] as const;
export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Nuevo",
  preparing: "En preparación",
  sent: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const ORDER_COLUMN_LABEL: Record<ActiveStatus, string> = {
  pending: "Nuevos",
  preparing: "En preparación",
  sent: "Enviados",
};

/** El botón de cada tarjeta dice lo que va a pasar, no el estado actual. */
export const ADVANCE_LABEL: Record<ActiveStatus, string> = {
  pending: "Preparar",
  preparing: "Enviar",
  sent: "Entregar",
};

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_STATUS_FLOW.indexOf(status);
  return i >= 0 && i < ORDER_STATUS_FLOW.length - 1 ? ORDER_STATUS_FLOW[i + 1] : null;
}

export function isActive(status: OrderStatus): status is ActiveStatus {
  return (ACTIVE_STATUSES as readonly OrderStatus[]).includes(status);
}

/** Clases de color por estado. El texto del estado va siempre al lado. */
export const STATUS_TONE: Record<OrderStatus, { dot: string; soft: string; ink: string }> = {
  pending: { dot: "bg-st-new", soft: "bg-st-new-soft", ink: "text-st-new-ink" },
  preparing: { dot: "bg-st-prep", soft: "bg-st-prep-soft", ink: "text-st-prep-ink" },
  sent: { dot: "bg-st-sent", soft: "bg-st-sent-soft", ink: "text-st-sent-ink" },
  delivered: { dot: "bg-st-done", soft: "bg-st-done-soft", ink: "text-st-done-ink" },
  cancelled: { dot: "bg-st-off", soft: "bg-st-off-soft", ink: "text-st-off-ink" },
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  datafono: "Datáfono",
};

/** El pago se confirma por chat después de que entra el pedido, así que un
 *  pedido recién llegado legítimamente no tiene método todavía. */
export function paymentLabel(method: PaymentMethod | null | undefined) {
  if (!method) return "Pago sin confirmar";
  return PAYMENT_LABEL[method] ?? method;
}

export function customerLabel(order: Pick<PortalOrder, "customerName" | "phone">) {
  return order.customerName ?? (order.phone ? formatPhone(order.phone) : "Sin nombre");
}

export function minutesBetween(from: string | Date, now: number) {
  const then = typeof from === "string" ? new Date(from) : from;
  return Math.max(0, Math.floor((now - then.getTime()) / 60000));
}

/** "4 min", "1 h 12 min": cuánto lleva un pedido esperando. */
export function elapsedLabel(minutes: number) {
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) return `${Math.floor(h / 24)} d`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function relativeTime(minutes: number) {
  if (minutes < 1) return "Justo ahora";
  return `Hace ${elapsedLabel(minutes)}`;
}

/**
 * ¿Este pedido se está demorando? Umbrales pensados para un domicilio que se
 * promete en 30 a 45 minutos: un pedido nuevo sin aceptar a los 5 minutos ya
 * es un cliente esperando sin respuesta.
 */
export function urgency(status: OrderStatus, minutes: number): "ok" | "warn" | "late" {
  const limits: Partial<Record<OrderStatus, [number, number]>> = {
    pending: [5, 10],
    preparing: [20, 30],
    sent: [30, 45],
  };
  const limit = limits[status];
  if (!limit) return "ok";
  if (minutes >= limit[1]) return "late";
  if (minutes >= limit[0]) return "warn";
  return "ok";
}
