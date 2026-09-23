import { CATALOG } from "./seed-data";
import { db } from "./client";
import { categories, optionGroups, options, products } from "./schema";

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
