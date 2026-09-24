import { normalize } from "./format";

/**
 * Tipos del catálogo y helpers **puros**.
 *
 * Este archivo no toca la base a propósito: lo importan el servidor y los
 * componentes de cliente de las tres apps, y arrastrar el driver de Postgres
 * al bundle del navegador rompe el build. Las consultas viven en
 * `src/db/queries/`.
 */

export type CatalogOption = {
  id: number;
  name: string;
  priceDelta: number;
};

export type CatalogOptionGroup = {
  id: number;
  name: string;
  type: "single" | "multi";
  required: boolean;
  options: CatalogOption[];
};

export type CatalogProduct = {
  id: number;
  sku: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  emoji: string | null;
  available: boolean;
  /** El id real de la categoría. Lo necesitan las promociones, que apuntan a
   *  categorías por id (`domain/promotions.ts`). */
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  optionGroups: CatalogOptionGroup[];
};

export type CatalogCategory = {
  id: number;
  slug: string;
  name: string;
  emoji: string | null;
  /** Una categoría oculta no sale en el menú público. Siempre `true` salvo
   *  que se pida el catálogo con `includeHidden` (solo lo hace el portal). */
  active: boolean;
  products: CatalogProduct[];
};

export function flatten(catalog: CatalogCategory[]): CatalogProduct[] {
  return catalog.flatMap((c) => c.products);
}

/**
 * Búsqueda de productos.
 *
 * Tres reglas, en orden de por qué existen:
 *
 * 1. Se normalizan los DOS lados, así "limón" encuentra `LIMON`.
 * 2. Un producto entra si **todas** las palabras de la consulta aparecen en
 *    algún lado de su texto. Así "limonada coco" no trae la categoría entera.
 * 3. Lo que coincide en el **nombre** va antes que lo que solo coincide en la
 *    descripción: quien busca "pollo" quiere el pollo, no la hamburguesa que
 *    lo menciona de pasada.
 *
 * El punto 3 es la lección cara del sistema real: sin él, buscar "limón" abría
 * la lista con snacks sabor limón y los limones de verdad quedaban últimos.
 */
export function searchProducts(catalog: CatalogCategory[], query: string) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  return flatten(catalog)
    .map((product) => {
      const name = normalize(product.name);
      const rest = normalize(`${product.description} ${product.categoryName}`);
      if (!tokens.every((t) => `${name} ${rest}`.includes(t))) return null;
      return { product, inName: tokens.filter((t) => name.includes(t)).length };
    })
    .filter((x): x is { product: CatalogProduct; inName: number } => x !== null)
    .sort((a, b) => b.inName - a.inName)
    .map((x) => x.product);
}

export function findBySku(catalog: CatalogCategory[], sku: string) {
  return flatten(catalog).find((p) => p.sku === sku);
}

export type ResolvedOption = {
  groupId: number;
  groupName: string;
  optionId: number;
  name: string;
  priceDelta: number;
};

/**
 * De los IDs de opción que mandó el cliente, cuáles existen de verdad en ESTE
 * producto — nunca al revés. Un `optionId` que no pertenece a ninguno de sus
 * grupos se ignora en silencio: es la forma en que un pedido armado contra un
 * catálogo viejo (opción ya borrada) no revienta, solo pierde esa opción.
 */
export function resolveOptions(
  product: CatalogProduct,
  optionIds: number[],
): ResolvedOption[] {
  const ids = new Set(optionIds);
  const resolved: ResolvedOption[] = [];
  for (const group of product.optionGroups) {
    for (const option of group.options) {
      if (ids.has(option.id)) {
        resolved.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          name: option.name,
          priceDelta: option.priceDelta,
        });
      }
    }
  }
  return resolved;
}

/** El precio de una línea (RN-02): el precio base más lo que sumen sus
 *  opciones, SIEMPRE resuelto contra el catálogo, nunca contra lo que mande
 *  el navegador. */
export function unitPriceWithOptions(
  product: CatalogProduct,
  optionIds: number[],
): number {
  return (
    product.price +
    resolveOptions(product, optionIds).reduce((sum, o) => sum + o.priceDelta, 0)
  );
}
