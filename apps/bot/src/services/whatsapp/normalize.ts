import type { IncomingMessage, WaMessage, WaWebhookPayload } from "./types";

/**
 * Convierte una entrega del webhook en una lista plana de `IncomingMessage`
 * (RF-07).
 *
 * Pura y sin efectos: no toca la base ni la red, así que se prueba con un
 * payload de ejemplo sin nada más levantado. El resto del sistema nunca ve la
 * forma de Meta — solo esto.
 *
 * **Descarta los `statuses`** (acuses de mensajes nuestros — enviado,
 * entregado, leído). Es la comprobación central de esa regla; el webhook la
 * repite a nivel de ruta como red de seguridad, pero la fuente de verdad es
 * esta función.
 */
export function extractIncomingMessages(payload: WaWebhookPayload): IncomingMessage[] {
  const out: IncomingMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const { value } = change;
      if (value.statuses?.length) continue; // acuses, no mensajes del cliente

      const profileByPhone = new Map<string, string | null>();
      for (const contact of value.contacts ?? []) {
        profileByPhone.set(contact.wa_id, contact.profile?.name ?? null);
      }

      for (const message of value.messages ?? []) {
        const normalized = normalizeOne(
          message,
          profileByPhone.get(message.from) ?? null,
        );
        if (normalized) out.push(normalized);
      }
    }
  }

  return out;
}

/**
 * El narrowing usa `in` a propósito, no un `switch` sobre `message.type`.
 *
 * `WaOtherMessage.type` es `string` (no un literal), así que un `switch`
 * sobre `type` deja ese miembro mezclado en cada rama y el compilador no dado
 * el `.text`/`.audio`/etc. de las otras variantes. Comprobar la PROPIEDAD
 * (`"text" in message`) sí distingue los miembros correctamente.
 */
function normalizeOne(
  message: WaMessage,
  profileName: string | null,
): IncomingMessage | null {
  const base = {
    waMessageId: message.id,
    phone: message.from,
    profileName,
    timestamp: new Date(Number(message.timestamp) * 1000),
  };

  if ("text" in message) {
    return { ...base, kind: "text", text: message.text.body };
  }

  if ("audio" in message) {
    return {
      ...base,
      kind: "audio",
      mediaId: message.audio.id,
      mimeType: message.audio.mime_type,
    };
  }

  if ("image" in message) {
    return {
      ...base,
      kind: "image",
      mediaId: message.image.id,
      mimeType: message.image.mime_type,
      caption: message.image.caption ?? null,
    };
  }

  if ("interactive" in message) {
    const reply = message.interactive.button_reply ?? message.interactive.list_reply;
    // Un `interactive` sin `button_reply` ni `list_reply` no debería ocurrir,
    // pero si Meta agrega un subtipo nuevo, se descarta en vez de reventar.
    if (!reply) return null;
    return { ...base, kind: "button", buttonId: reply.id, title: reply.title };
  }

  return { ...base, kind: "unsupported", type: message.type };
}
