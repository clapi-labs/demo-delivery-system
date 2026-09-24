import { asc, eq } from "drizzle-orm";

import type {
  CatalogCategory,
  CatalogOption,
  CatalogOptionGroup,
} from "../../domain/catalog";
import { db } from "../client";
import { categories, optionGroups, options, products } from "../schema";

/**
 * El catálogo completo (RF-02).
 *
 * Cuatro consultas planas y el armado en memoria, en vez de joins anidados: el
 * catálogo son ~25 productos, así que la claridad gana y no hay nada que
 * optimizar todavía.
 *
 * Vive en `packages/shared` porque lo necesitan las tres apps: el menú para
 * pintarlo, el bot para responder de productos, y el portal para el detalle de
 * un pedido. Tres copias de esta consulta se desincronizan sin que nadie lo
 * note.
 */
export async function getCatalog(
  /**
   * `includeHidden` trae también las categorías ocultas. Lo usa **solo el
   * portal**: el restaurante tiene que poder ver lo que escondió para volver a
   * mostrarlo. El menú público y el bot nunca lo pasan — si lo hicieran, el
   * interruptor de "oculta" no serviría para nada.
   */
  options_: { includeHidden?: boolean } = {},
): Promise<CatalogCategory[]> {
  const [cats, prods, groups, opts] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(options_.includeHidden ? undefined : eq(categories.active, true))
      .orderBy(asc(categories.sortOrder)),
    db.select().from(products).orderBy(asc(products.sortOrder)),
    db.select().from(optionGroups).orderBy(asc(optionGroups.sortOrder)),
    db.select().from(options).orderBy(asc(options.sortOrder)),
  ]);

  const optionsByGroup = new Map<number, CatalogOption[]>();
  for (const opt of opts) {
    const list = optionsByGroup.get(opt.groupId) ?? [];
    list.push({ id: opt.id, name: opt.name, priceDelta: opt.priceDelta });
    optionsByGroup.set(opt.groupId, list);
  }

  const groupsByProduct = new Map<number, CatalogOptionGroup[]>();
  for (const group of groups) {
    const list = groupsByProduct.get(group.productId) ?? [];
    list.push({
      id: group.id,
      name: group.name,
      type: group.type,
      required: group.required,
      options: optionsByGroup.get(group.id) ?? [],
    });
    groupsByProduct.set(group.productId, list);
  }

  return cats.map((cat) => ({
    id: cat.id,
    slug: cat.slug,
    name: cat.name,
    emoji: cat.emoji,
    active: cat.active,
    products: prods
      .filter((p) => p.categoryId === cat.id)
      .map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        price: p.price,
        imageUrl: p.imageUrl,
        emoji: p.emoji,
        available: p.available,
        categoryId: cat.id,
        categorySlug: cat.slug,
        categoryName: cat.name,
        optionGroups: groupsByProduct.get(p.id) ?? [],
      })),
  }));
}
