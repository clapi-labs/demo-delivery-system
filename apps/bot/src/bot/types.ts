/** Lo que cualquier pieza del motor devuelve para un turno. */
export type BotReply = {
  text: string;
  /** Botones de respuesta rápida (máximo 3, WhatsApp los recorta a 20 caracteres). */
  buttons?: { id: string; title: string }[];
  /** Link al menú, cuando el turno lo amerita. */
  menu?: { url: string; label: string };
  /** El turno escaló a una persona: la bandeja lo muestra destacado (Fase 5). */
  escalated?: { reason: string };
};
