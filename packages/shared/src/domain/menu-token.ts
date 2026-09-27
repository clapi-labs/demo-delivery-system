import { signToken, verifyToken } from "./signed-token";

/**
 * El token firmado que viaja en el link del menú.
 *
 * **Es la pieza que hace que el pedido vuelva solo a WhatsApp.** El bot manda
 * `…/menu?t=<token>`; el token dice de qué teléfono es la conversación, así
 * que cuando el cliente le da "enviar" en el menú, el sistema ya sabe a quién
 * contestarle — sin pedirle que copie un código a mano.
 *
 * Firmado con HMAC porque el link viaja por WhatsApp y termina en el
 * navegador del cliente: sin firma, cualquiera podría pedir a nombre de otro
 * número cambiando un parámetro de la URL.
 *
 * No es una sesión ni una credencial: no da acceso a nada, solo identifica el
 * hilo. Y **caduca**, para que un link viejo reenviado a un grupo no siga
 * sirviendo. La firma y la caducidad las hace `signed-token.ts`, que comparte
 * con el link del repartidor.
 */

const DEFAULT_TTL_HOURS = 24;

export type MenuTokenPayload = {
  /** El `wa_id` del cliente. */
  phone: string;
  /** Emisión, en segundos desde epoch. */
  iat: number;
  /** Expiración, en segundos desde epoch. */
  exp: number;
};

export function createMenuToken(phone: string, secret: string, ttlHours = DEFAULT_TTL_HOURS) {
  return signToken({ phone }, secret, ttlHours);
}

/**
 * Devuelve el payload, o `null` si el token es inválido o caducó.
 *
 * Nunca lanza: un token roto es un cliente que abrió un link viejo, no un
 * error del sistema. El menú cae al modo anónimo y el cliente manda el código
 * a mano, que es el respaldo de siempre.
 */
export function verifyMenuToken(
  token: string | null | undefined,
  secret: string,
): MenuTokenPayload | null {
  return verifyToken<{ phone: string }>(token, secret, (raw) => {
    const phone = (raw as { phone?: unknown }).phone;
    return typeof phone === "string" && phone ? { phone } : null;
  });
}
