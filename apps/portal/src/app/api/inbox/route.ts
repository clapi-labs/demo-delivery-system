/**
 * La bandeja de conversaciones (Fase 5).
 *
 * Esto REEMPLAZA a Chatwoot. Los mensajes ya están en nuestra base porque el
 * bot los escribe al recibirlos y al responder, así que la bandeja no espeja
 * nada: lee la fuente.
 *
 * GET: lista de conversaciones + hilo de una.
 * POST: responder (pausa el bot en ESA conversación), o marcar resuelta
 * (lo reactiva).
 *
 * La regla: abrir una conversación NO pausa al asistente; responder SÍ. Abrir
 * un chat es mirar, escribir es tomarlo.
 *
 * Muestra además cuánto queda de la ventana de 24 h (`windowRemaining`), para
 * que el agente sepa si puede escribir antes de intentarlo.
 */
export {};
