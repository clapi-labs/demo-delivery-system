import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificación de que el webhook viene de verdad de Meta.
 *
 * **Sin esto, la URL del webhook es un endpoint público que dispara mensajes
 * de WhatsApp en nombre del restaurante.** Cualquiera que la descubra puede
 * inyectar conversaciones falsas, generar pedidos y quemar créditos de OpenAI.
 * No es una capa opcional de seguridad: es la única que hay.
 *
 * Meta firma cada entrega con HMAC-SHA256 del cuerpo **crudo**, usando el App
 * Secret, y la manda en `X-Hub-Signature-256: sha256=<hex>`.
 */

/**
 * El cuerpo tiene que ser el texto **exacto** que llegó.
 *
 * Si se parsea el JSON y se vuelve a serializar, un espacio o un orden de
 * claves distinto cambia el hash y la firma no cuadra nunca. Por eso quien
 * llama usa `await request.text()` y solo después hace `JSON.parse`.
 */
export function isValidSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;

  const [algorithm, received] = signatureHeader.split("=");
  if (algorithm !== "sha256" || !received) return false;

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(received, "hex");
  const b = Buffer.from(expected, "hex");

  // Comparación en tiempo constante: comparar con `===` filtra información
  // sobre cuántos bytes coinciden y abre la puerta a un ataque de tiempo.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * El apretón de manos inicial (`GET`).
 *
 * Meta llama una sola vez al configurar el webhook con `hub.mode=subscribe` y
 * el `hub.verify_token` que escribiste en su panel. Hay que devolver el
 * `hub.challenge` **en texto plano** — no JSON, o la verificación falla sin
 * decir por qué.
 */
export function handleVerification(
  url: URL,
  expectedToken: string,
): { ok: true; challenge: string } | { ok: false } {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return { ok: true, challenge };
  }
  return { ok: false };
}
