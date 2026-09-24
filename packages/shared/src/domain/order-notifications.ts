import { BUSINESS } from "../config/business-info";
import type { OrderStatus } from "./order-status";

/**
 * El aviso que recibe el cliente cuando su pedido cambia de estado
 * (RF-30, RF-31).
 *
 * Vive en `packages/shared` porque lo escribe el **portal** (al cambiar el
 * estado encola la fila en `notifications`) y lo manda el **bot** (al barrer
 * el outbox). Si el texto viviera en uno de los dos, el otro tendría que
 * adivinarlo.
 *
 * El tono es el de un negocio que quiere que vuelvas: nombra el pedido por su
 * código —para que el cliente sepa cuál de los suyos es— y dice qué sigue. No
 * lleva "veci" ni emojis de más: un aviso automático que suena demasiado
 * coloquial se lee como spam.
 *
 * **El agradecimiento va solo en el último mensaje.** Repetir "gracias por
 * preferirnos" en cada paso lo vacía de sentido y alarga tres avisos que el
 * cliente lee de reojo mientras espera su comida. En el de entrega sí: ahí la
 * despedida es el mensaje.
 *
 * `pending` no genera aviso: es el estado en el que nace el pedido, y el
 * cliente ya recibió la confirmación en el chat cuando lo cerró.
 */
export function orderStatusMessage(status: OrderStatus, code: string): string | null {
  switch (status) {
    case "preparing":
      return (
        `👨‍🍳 ¡Manos a la obra! Tu pedido *${code}* ya está en preparación.\n\n` +
        `Te avisamos apenas salga para tu dirección.`
      );

    case "sent":
      return (
        `🛵 ¡Tu pedido *${code}* ya va en camino!\n\n` +
        `Llega en aproximadamente ${BUSINESS.deliveryTime}. Ten a la mano el pago si es en efectivo.`
      );

    case "delivered":
      return (
        `✅ Tu pedido *${code}* fue entregado con éxito.\n\n` +
        `¡Que disfrutes tu comida! Gracias por preferir *${BUSINESS.name}*. ` +
        `Aquí estaremos para tu próximo antojo.`
      );

    case "cancelled":
      return (
        `Tu pedido *${code}* fue cancelado.\n\n` +
        `Si crees que se trata de un error, respóndenos por este mismo chat y lo revisamos enseguida.\n\n` +
        `Gracias por tu comprensión. — *${BUSINESS.name}*`
      );

    default:
      return null;
  }
}
