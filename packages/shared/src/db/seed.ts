import { inArray } from "drizzle-orm";

import { CATALOG, PROMOTIONS } from "./seed-data";
import { db } from "./client";
import { categories, optionGroups, options, products, promotions } from "./schema";

/**
 * Carga el catálogo del restaurante (RF-03).
 *
 * A diferencia de la demo anterior, acá no hay `demo_id`: es un solo
 * restaurante, así que sembrar significa **reemplazar todo el catálogo**. Se
 * borra por completo antes de reinsertar — los borrados en cascada del
 * esquema se encargan de grupos y opciones huérfanos.
 *
 * Los pedidos ya hechos NO se tocan: `orderItems` congela nombre y precio al
 * momento del pedido justamente para que recargar el catálogo no reescriba el
 * historial.
 */
export async function seedCatalog() {
  await db.delete(categories);

  for (const [categoryIndex, cat] of CATALOG.entries()) {
    const [insertedCategory] = await db
      .insert(categories)
      .values({
        slug: cat.slug,
        name: cat.name,
        emoji: cat.emoji,
        sortOrder: categoryIndex,
      })
      .returning();

    for (const [productIndex, prod] of cat.products.entries()) {
      const [insertedProduct] = await db
        .insert(products)
        .values({
          categoryId: insertedCategory.id,
          sku: prod.sku,
          name: prod.name,
          description: prod.description,
          price: prod.price,
          emoji: prod.emoji,
          available: prod.available ?? true,
          sortOrder: productIndex,
        })
        .returning();

      for (const [groupIndex, group] of (prod.optionGroups ?? []).entries()) {
        const [insertedGroup] = await db
          .insert(optionGroups)
          .values({
            productId: insertedProduct.id,
            name: group.name,
            type: group.type,
            required: group.required ?? false,
            sortOrder: groupIndex,
          })
          .returning();

        await db.insert(options).values(
          group.options.map((opt, optionIndex) => ({
            groupId: insertedGroup.id,
            name: opt.name,
            priceDelta: opt.priceDelta ?? 0,
            sortOrder: optionIndex,
          })),
        );
      }
    }
  }
}

/**
 * Carga las promociones de ejemplo.
 *
 * **Va siempre después de `seedCatalog`, nunca sola.** Una promoción apunta a
 * categorías y productos por id, y sembrar el catálogo borra y reinserta todo:
 * los ids cambian. Por eso la semilla las declara por `slug` y `sku` y acá se
 * resuelven contra lo que quedó en la base. Por eso mismo se borran todas
 * antes: una promo vieja apuntaría a ids que ya no existen y el cliente vería
 * un descuento sobre nada.
 */
export async function seedPromotions() {
  await db.delete(promotions);

  const slugs = [...new Set(PROMOTIONS.flatMap((p) => p.categorySlugs ?? []))];
  const skus = [...new Set(PROMOTIONS.flatMap((p) => p.skus ?? []))];

  const cats = slugs.length
    ? await db.select().from(categories).where(inArray(categories.slug, slugs))
    : [];
  const prods = skus.length
    ? await db.select().from(products).where(inArray(products.sku, skus))
    : [];

  const categoryId = new Map(cats.map((c) => [c.slug, c.id]));
  const productId = new Map(prods.map((p) => [p.sku, p.id]));

  for (const [index, promo] of PROMOTIONS.entries()) {
    const scope = promo.categorySlugs
      ? { type: "category" as const, ids: promo.categorySlugs.map((s) => categoryId.get(s)!).filter(Boolean) }
      : promo.skus
        ? { type: "products" as const, ids: promo.skus.map((s) => productId.get(s)!).filter(Boolean) }
        : { type: "all" as const };

    await db.insert(promotions).values({
      name: promo.name,
      kind: promo.kind,
      value: promo.value ?? 0,
      scope,
      days: promo.days,
      fromTime: promo.from ?? null,
      toTime: promo.to ?? null,
      active: promo.active ?? true,
      sortOrder: index,
    });
  }
}
