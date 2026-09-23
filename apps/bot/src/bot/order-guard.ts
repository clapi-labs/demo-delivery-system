import type { Order } from "@/db/queries/orders";

/**
 * El candado de ADR-02 / RF-16.
 *
 * Un pedido que no nació del menú no se registra jamás. Se comprueba contra
 * la fila de la base — `source` y `redeemedAt` — nunca contra una variable en
 * memoria: así el candado es auditable (se puede revisar en la base sin leer
 * código) y no depende de que nadie se salte un `if` en el camino.
 *
 * Es la única función que decide si un pedido puede cerrarse. `engine.ts` la
 * llama en el único punto donde un pedido pasa a ser real — no hay un segundo
 * lugar donde este chequeo se repita o se olvide.
 */
export function assertMenuOrder(order: Order): boolean {
  return order.source === "menu" && order.redeemedAt !== null;
}
