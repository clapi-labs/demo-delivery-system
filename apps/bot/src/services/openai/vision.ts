/**
 * Lectura de comprobantes de pago (Fase 5).
 *
 * Extrae monto, referencia y fecha de la imagen. La decisión es BINARIA:
 * o todo cuadra y el pago queda validado, o el pedido se registra igual con el
 * pago en revisión y se escala a una persona con el motivo concreto. Nunca se
 * deja al cliente esperando por una duda del sistema.
 */
export {};
