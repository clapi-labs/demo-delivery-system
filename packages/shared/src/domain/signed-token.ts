import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tokens firmados: la base del link del menú y del link del repartidor.
 *
 * Los dos son el mismo problema — un enlace que viaja por WhatsApp y termina
 * en el navegador de otra persona, y que tiene que decir de quién es sin que
 * nadie pueda cambiarlo editando la URL — así que la firma se escribe una vez
 * y no dos.
 *
 * No son sesiones ni credenciales: no hay contraseña que recordar, que es todo
 * el punto. Un domiciliario no va a instalar una app ni a inventarse un
 * usuario; toca su link y ve sus pedidos. Por eso **caducan**: un link viejo
 * reenviado a un grupo deja de servir solo.
 */

const SEPARATOR = ".";

export function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function fromBase64url(input: string) {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(data: string, secret: string) {
  return base64url(createHmac("sha256", secret).update(data).digest());
}

/** Datos mínimos de cualquier token: cuándo se emitió y cuándo caduca. */
export type TokenTimes = {
  /** Emisión, en segundos desde epoch. */
  iat: number;
  /** Expiración, en segundos desde epoch. */
  exp: number;
};

export function signToken<T extends object>(payload: T, secret: string, ttlHours: number) {
  const now = Math.floor(Date.now() / 1000);
  const times: TokenTimes = { iat: now, exp: now + ttlHours * 3600 };
  const body = base64url(JSON.stringify({ ...payload, ...times }));
  return `${body}${SEPARATOR}${sign(body, secret)}`;
}

/**
 * Devuelve el payload, o `null` si el token es inválido o caducó.
 *
 * **Nunca lanza.** Un token roto es alguien que abrió un link viejo, no un
 * error del sistema: quien llama decide qué hacer (el menú cae al modo
 * anónimo, la pantalla del repartidor pide un link nuevo).
 */
export function verifyToken<T>(
  token: string | null | undefined,
  secret: string,
  parse: (payload: unknown) => T | null,
): (T & TokenTimes) | null {
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
    const raw = JSON.parse(fromBase64url(body).toString()) as TokenTimes & Record<string, unknown>;
    if (typeof raw.exp !== "number" || raw.exp < Math.floor(Date.now() / 1000)) return null;
    const parsed = parse(raw);
    if (parsed === null) return null;
    return { ...parsed, iat: raw.iat, exp: raw.exp };
  } catch {
    return null;
  }
}
