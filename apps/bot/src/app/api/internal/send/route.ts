/**
 * El portal manda un mensaje al cliente (Fase 5).
 *
 * Lo usa el agente cuando responde desde la bandeja. El orden importa:
 * PRIMERO se pausa el bot, DESPUÉS se envía. Al revés, un fallo entre los dos
 * pasos deja al cliente con la respuesta de la persona y el bot contestándole
 * encima.
 */
export {};
