/** Lo que cualquier pieza del motor devuelve para un turno. */
export type BotReply = {
  text: string;
  /** Botones de respuesta rápida (máximo 3, WhatsApp los recorta a 20 caracteres). */
  buttons?: { id: string; title: string }[];
  /** Link al menú, cuando el turno lo amerita. */
  menu?: { url: string; label: string };
  /**
   * Foto que acompaña la respuesta.
   *
   * Si el turno además lleva `menu`, viaja como encabezado DENTRO de ese
   * mismo mensaje (foto arriba, texto, botón abajo) — comprobado contra la
   * API real. Si no hay menú, sale sola y antes del texto.
   */
  image?: { url: string };
  /** El turno escaló a una persona: la bandeja lo muestra destacado (Fase 5). */
  escalated?: { reason: string };
};

/**
 * Lo que guarda `messages.meta` para que la bandeja del portal pinte el
 * mensaje sin volver a razonarlo (ver el comentario del esquema).
 *
 * A propósito NO es `reply.buttons`/`reply.menu` tal cual: esos traen el
 * `id` interno que solo necesita la API de WhatsApp para saber qué tecleó el
 * cliente. Persistir ese `id` filtra un detalle de transporte a la bandeja —
 * ya pasó: `{ buttons: [{id,title}] }` llegó crudo hasta el navegador y
 * `Thread.tsx` (que espera `buttons: string[]`) reventó al intentar pintarlo.
 */
export function inboxMeta(reply: BotReply): { buttons?: string[]; cta?: string } | undefined {
  const buttons = reply.buttons?.map((b) => b.title);
  const cta = reply.menu?.label;
  if (!buttons && !cta) return undefined;
  return { ...(buttons ? { buttons } : {}), ...(cta ? { cta } : {}) };
}
