/** Lo que cualquier pieza del motor devuelve para un turno. */
export type BotReply = {
  text: string;
  /** Botones de respuesta rápida (máximo 3, WhatsApp los recorta a 20 caracteres). */
  buttons?: { id: string; title: string }[];
  /** Link al menú, cuando el turno lo amerita. */
  menu?: { url: string; label: string };
  /**
   * Imagen que se manda ANTES del texto, en su propio mensaje.
   *
   * Va aparte porque WhatsApp no deja combinar una imagen con un botón
   * `cta_url` en el mismo mensaje: o es imagen con pie de foto, o es
   * interactivo. La bienvenida quiere las dos cosas, así que son dos envíos.
   */
  image?: { url: string };
  /** El turno escaló a una persona: la bandeja lo muestra destacado (Fase 5). */
  escalated?: { reason: string };
};
