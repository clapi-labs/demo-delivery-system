import { asc, eq } from "drizzle-orm";

import type { Promotion } from "../../domain/promotions";
import { db } from "../client";
import { promotions } from "../schema";

/**
 * Las promociones (Fase 5).
 *
 * Vive en `packages/shared` por lo mismo que `catalog.ts`: las leen el portal
 * (para administrarlas), el menú (para el precio) y el bot (para contestar por
 * ellas).
 *
 * La fila de la base y la `Promotion` del dominio no tienen la misma forma a
 * propósito — en la base las horas son `from_time`/`to_time` (nombres que se
 * leen en SQL), y en el dominio son `from`/`to` (que es como se lee en una
 * interfaz). El mapeo vive acá y en ningún otro sitio.
 */

type Row = typeof promotions.$inferSelect;

function toPromotion(row: Row): Promotion {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    value: row.value,
    scope: row.scope,
    days: row.days,
    from: row.fromTime,
    to: row.toTime,
    active: row.active,
  };
}

export async function getPromotions(): Promise<Promotion[]> {
  const rows = await db.select().from(promotions).orderBy(asc(promotions.sortOrder), asc(promotions.id));
  return rows.map(toPromotion);
}

/** Crea o actualiza. `id === 0` significa nueva, como en el editor del portal. */
export async function savePromotion(promo: Promotion): Promise<Promotion> {
  const values = {
    name: promo.name,
    kind: promo.kind,
    value: promo.value,
    scope: promo.scope,
    days: promo.days,
    fromTime: promo.from,
    toTime: promo.to,
    active: promo.active,
  };

  if (promo.id === 0) {
    const [created] = await db.insert(promotions).values(values).returning();
    return toPromotion(created);
  }

  const [updated] = await db
    .update(promotions)
    .set(values)
    .where(eq(promotions.id, promo.id))
    .returning();

  // Editar una promoción que alguien más borró no debería reventar la
  // pantalla: se trata como una creación.
  if (!updated) {
    const [created] = await db.insert(promotions).values(values).returning();
    return toPromotion(created);
  }
  return toPromotion(updated);
}

export async function setPromotionActive(id: number, active: boolean) {
  await db.update(promotions).set({ active }).where(eq(promotions.id, id));
}

export async function deletePromotion(id: number) {
  await db.delete(promotions).where(eq(promotions.id, id));
}
