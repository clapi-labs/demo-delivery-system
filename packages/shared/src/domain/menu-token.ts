import { createHmac, timingSafeEqual } from "node:crypto";

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
 * sirviendo.
 */

const SEPARATOR = ".";
const DEFAULT_TTL_HOURS = 24;

export type MenuTokenPayload = {
  /** El `wa_id` del cliente. */
  phone: string;
  /** Emisión, en segundos desde epoch. */
  iat: number;
  /** Expiración, en segundos desde epoch. */
  exp: number;
};

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(input: string) {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(data: string, secret: string) {
  return base64url(createHmac("sha256", secret).update(data).digest());
}

export function createMenuToken(
  phone: string,
  secret: string,
  ttlHours = DEFAULT_TTL_HOURS,
) {
  const now = Math.floor(Date.now() / 1000);
  const payload: MenuTokenPayload = {
    phone,
    iat: now,
    exp: now + ttlHours * 3600,
  };

  const body = base64url(JSON.stringify(payload));
  return `${body}${SEPARATOR}${sign(body, secret)}`;
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
  if (!token) return null;

  const [body, signature] = token.split(SEPARATOR);
  if (!body || !signature) return null;

  const expected = sign(body, secret);

  // Comparación en tiempo constante: comparar firmas con `===` filtra
  // información sobre cuántos caracteres coinciden.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromBase64url(body).toString()) as MenuTokenPayload;
    if (typeof payload.phone !== "string" || !payload.phone) return null;
    if (typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
