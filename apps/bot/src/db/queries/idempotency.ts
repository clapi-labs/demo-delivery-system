import { db, processedMessages } from "@sistema/shared/db";

/**
 * Idempotencia del webhook (RF-06).
 *
 * Meta reintenta la entrega si no respondemos 200 a tiempo, así que el mismo
 * mensaje puede llegar más de una vez. `waMessageId` es la clave primaria de
 * `processed_messages`: el INSERT falla solo si ya existía, y esa atomicidad
 * es lo que evita la carrera entre dos entregas casi simultáneas — un `SELECT`
 * previo seguido de un `INSERT` tendría una ventana donde dos reintentos
 * pasan la comprobación a la vez.
 *
 * Devuelve `true` la primera vez que se ve este mensaje (hay que procesarlo),
 * `false` si ya se había procesado (se descarta en silencio, sin error).
 */
export async function markProcessedIfNew(waMessageId: string): Promise<boolean> {
  const inserted = await db
    .insert(processedMessages)
    .values({ waMessageId })
    .onConflictDoNothing({ target: processedMessages.waMessageId })
    .returning({ id: processedMessages.waMessageId });

  return inserted.length > 0;
}
