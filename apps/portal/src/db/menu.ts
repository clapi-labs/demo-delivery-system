import { eq } from "drizzle-orm";

import {
  db,
  getCatalog,
  getPromotions,
  products as productsTable,
} from "@sistema/shared/db";

import type { MenuCategory, MenuProduct, MenuSymbolName } from "@/lib/menu";

/**
 * El menú que administra el restaurante, leído de Neon.
 *
 * Es el MISMO catálogo que ve el cliente en `apps/menu` y el que consulta el
 * bot para responder: `getCatalog()` vive en `packages/shared` justamente para
 * que no existan tres copias. Acá solo se traduce a la forma que usan las
 * pantallas del portal.
 *
 * Una diferencia importante con el catálogo público: **el portal ve también
 * las categorías ocultas**. `getCatalog()` filtra por `active` porque el
 * cliente no debe ver lo que el restaurante escondió; el restaurante sí tiene
 * que verlo, o no habría forma de volver a mostrarlo.
 */

/**
 * El símbolo de cada categoría.
 *
 * En la base, `categories.emoji` guarda un emoji de verdad (lo usa el menú
 * público y el bot); el portal dibuja símbolos vectoriales, que es otra cosa.
 * El puente es el `slug`, que es estable, en vez de meter una columna nueva
 * para un detalle de una sola pantalla.
 */
const SYMBOL_BY_SLUG: Record<string, MenuSymbolName> = {
  hamburguesas: "burger",
  pollo: "chicken",
  acompanamientos: "fries",
  bebidas: "drink",
  postres: "dessert",
  pizzas: "pizza",
  perros: "hotdog",
};

export type PortalMenu = {
  categories: MenuCategory[];
  products: MenuProduct[];
};

export async function getPortalMenu(): Promise<PortalMenu> {
  const catalog = await getCatalog({ includeHidden: true });

  const categories: MenuCategory[] = catalog.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    symbol: SYMBOL_BY_SLUG[c.slug] ?? "plate",
    active: c.active,
  }));

  const products: MenuProduct[] = catalog.flatMap((c) =>
    c.products.map((p) => ({
      id: p.id,
      categoryId: c.id,
      name: p.name,
      description: p.description,
      price: p.price,
      imageUrl: p.imageUrl,
      available: p.available,
      optionGroups: p.optionGroups,
    })),
  );

  return { categories, products };
}

/**
 * Marcar algo como agotado.
 *
 * Es la escritura más usada del Menú y la que más se nota: el menú público y
 * el asistente leen `products.available` en cada consulta, así que apagar un
 * producto acá lo saca de las dos partes sin ningún otro paso.
 */
export async function setProductAvailable(productId: number, available: boolean) {
  const updated = await db
    .update(productsTable)
    .set({ available })
    .where(eq(productsTable.id, productId))
    .returning({ id: productsTable.id });

  return updated.length > 0;
}

export { getPromotions };
