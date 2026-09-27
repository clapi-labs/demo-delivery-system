/**
 * Los estados de un pedido.
 *
 * Vive en `domain/` y no en `db/schema.ts` por la misma razón que
 * `PaymentMethod`: lo necesitan componentes de cliente del portal y el texto
 * de los avisos, y cualquier cosa que importe el esquema arrastra el driver
 * de Postgres al bundle del navegador.
 *
 * `draft` lo crea el menú; pasa a `pending` solo cuando el asistente canjeó el
 * código y cerró dirección y pago. El portal no muestra borradores: un carrito
 * que nadie cerró no es un pedido.
 */
export type OrderStatus =
  | "draft"
  | "pending"
  | "preparing"
  | "sent"
  | "delivered"
  | "cancelled";

/**
 * Por dónde entró el pedido.
 *
 * `menu` es el camino de siempre: el cliente armó el carrito en el navegador y
 * el asistente canjeó el código. `call` es un pedido tomado por el agente de
 * voz (ADR-13), y es la **única** excepción al candado de ADR-02 — existe como
 * columna para que la excepción sea auditable en la base y no una suposición:
 * si un pedido no nació del menú, la base dice de dónde vino.
 *
 * El chat de WhatsApp sigue sin poder crear pedidos. No hay valor para eso.
 */
export type OrderSource = "menu" | "call";

export const ORDER_SOURCE_LABEL: Record<OrderSource, string> = {
  menu: "Por el menú",
  call: "Por llamada",
};
