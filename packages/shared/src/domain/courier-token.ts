import { signToken, verifyToken } from "./signed-token";

/**
 * El token firmado del link del repartidor.
 *
 * Es lo que le permite a un domiciliario ver sus pedidos y marcar la entrega
 * **sin usuario ni contraseña**: el restaurante le manda su link una vez y él
 * lo guarda en el celular. Pedirle que se registre en un portal es la forma
 * más rápida de que no lo use nunca y siga llamando al local.
 *
 * Firmado con HMAC porque va por WhatsApp: sin firma, cambiar un número en la
 * URL dejaría ver —y cerrar— los pedidos de otro.
 *
 * Dura 30 días, no 24 horas como el del menú: el del menú identifica una
 * conversación puntual, este es la herramienta de trabajo de alguien que
 * reparte todos los días. Cuando caduca, el portal genera otro.
 */

const DEFAULT_TTL_DAYS = 30;

export type CourierTokenPayload = {
  /** El id del domiciliario en `couriers`. */
  courierId: number;
};

export function createCourierToken(courierId: number, secret: string, ttlDays = DEFAULT_TTL_DAYS) {
  return signToken<CourierTokenPayload>({ courierId }, secret, ttlDays * 24);
}

export function verifyCourierToken(token: string | null | undefined, secret: string) {
  return verifyToken<CourierTokenPayload>(token, secret, (raw) => {
    const id = (raw as { courierId?: unknown }).courierId;
    return typeof id === "number" && Number.isInteger(id) && id > 0 ? { courierId: id } : null;
  });
}
