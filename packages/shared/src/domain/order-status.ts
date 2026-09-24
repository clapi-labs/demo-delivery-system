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
