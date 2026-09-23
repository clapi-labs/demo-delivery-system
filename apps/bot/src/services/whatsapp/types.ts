/**
 * La forma del webhook de la Cloud API.
 *
 * Solo lo que usamos. El payload real trae bastante más, pero declarar de más
 * es comprometerse con una forma que Meta puede cambiar.
 *
 * Dos cosas que sorprenden la primera vez:
 *
 * 1. **`statuses` y `messages` llegan por el mismo webhook.** Los `statuses`
 *    son acuses (enviado / entregado / leído) de mensajes NUESTROS. Si no se
 *    distinguen, el bot intenta contestarle a su propio acuse.
 * 2. Todo viene anidado en `entry[].changes[].value`, y los arreglos pueden
 *    traer varios elementos en una sola entrega.
 */

export type WaTextMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: "text";
  text: { body: string };
};

export type WaAudioMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: "audio";
  audio: { id: string; mime_type: string; voice?: boolean };
};

export type WaImageMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: "image";
  image: { id: string; mime_type: string; caption?: string };
};

/** Respuesta a un botón de respuesta rápida. */
export type WaInteractiveMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: "interactive";
  interactive: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
};

/** Tipos que no atendemos (sticker, ubicación, contacto…). */
export type WaOtherMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
};

export type WaMessage =
  | WaTextMessage
  | WaAudioMessage
  | WaImageMessage
  | WaInteractiveMessage
  | WaOtherMessage;

export type WaContact = {
  wa_id: string;
  profile?: { name?: string };
};

export type WaStatus = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipient_id: string;
  errors?: { code: number; title: string; message?: string }[];
};

export type WaWebhookPayload = {
  object: string;
  entry?: {
    id: string;
    changes?: {
      field: string;
      value: {
        messaging_product: string;
        metadata?: { phone_number_id: string; display_phone_number: string };
        contacts?: WaContact[];
        messages?: WaMessage[];
        statuses?: WaStatus[];
      };
    }[];
  }[];
};

/** Lo que el orquestador necesita de un mensaje entrante, ya normalizado. */
export type IncomingMessage = {
  waMessageId: string;
  phone: string;
  profileName: string | null;
  timestamp: Date;
} & (
  | { kind: "text"; text: string }
  | { kind: "audio"; mediaId: string; mimeType: string }
  | { kind: "image"; mediaId: string; mimeType: string; caption: string | null }
  | { kind: "button"; buttonId: string; title: string }
  | { kind: "unsupported"; type: string }
);
