/**
 * Cómo paga el cliente.
 *
 * Vive en `domain/` y no en `db/schema.ts` aunque la columna lo use: el menú
 * lo necesita en un componente de CLIENTE (los botones de pago), y cualquier
 * cosa importada desde `db/` se trae el driver de Postgres al bundle del
 * navegador y revienta el build.
 *
 * `datafono` es cobro con tarjeta contra entrega — el domiciliario lleva el
 * datáfono. Para el sistema se comporta como el efectivo (se cobra al
 * recibir); lo que cambia es lo que hay que decirle al cliente.
 */
export type PaymentMethod = "efectivo" | "transferencia" | "datafono";

export const PAYMENT_METHODS: PaymentMethod[] = ["efectivo", "transferencia", "datafono"];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && PAYMENT_METHODS.includes(value as PaymentMethod);
}
