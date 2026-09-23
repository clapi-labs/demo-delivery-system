/**
 * Abrir WhatsApp desde el menú sin pasar por la ventana intermedia de `wa.me`.
 *
 * Portado del sistema real (allá es RF-37/ADR-42), donde el problema ya se
 * pagó una vez:
 *
 * `wa.me/<numero>` no abre WhatsApp: abre una PÁGINA de WhatsApp que pregunta
 * si quieres descargar la app o seguir en WhatsApp Web. En celular casi
 * siempre salta sola a la app y pasa desapercibida. En computador es donde
 * duele — mucha gente lee ese interstitial como "tengo que instalar algo" y
 * ahí abandona el pedido, que es exactamente el momento que no se puede
 * perder.
 *
 * Se resuelve mandando a cada dispositivo al destino que le sirve, en vez de
 * al intermediario.
 */

/**
 * ¿Es un dispositivo donde vive la app nativa de WhatsApp?
 *
 * Se mira `maxTouchPoints` además del user agent porque el iPad se anuncia
 * como "Macintosh" desde hace años: por user agent solo pasaría por
 * escritorio, que es justo al revés de lo que hace falta.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPod|Windows Phone/i.test(ua)) return true;
  return /iPad|Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * El destino de WhatsApp que le sirve a ESTE dispositivo.
 *
 * - Celular → `whatsapp://send`, el esquema que abre la app directo.
 * - Computador → `web.whatsapp.com/send`, la página real, sin la pregunta
 *   previa.
 *
 * `text` es opcional **a propósito**: cuando el pedido ya se envió solo no
 * hay nada que pre-escribir, y dejar un "#PEDIDO" escrito que el cliente no
 * necesita mandar es invitarlo a duplicar el pedido.
 */
export function whatsappChatUrl(phone: string, text?: string): string {
  const query = new URLSearchParams({ phone });
  if (text) query.set("text", text);

  return isMobileDevice()
    ? `whatsapp://send?${query.toString()}`
    : `https://web.whatsapp.com/send?${query.toString()}`;
}
