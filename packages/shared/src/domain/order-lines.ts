import { findBySku, priceLine, resolveOptions, type CatalogCategory } from "./catalog";
import type { Promotion } from "./promotions";

/**
 * Armar las líneas de un pedido a partir de referencias (RN-02).
 *
 * Vivía dentro de `apps/menu/src/app/api/orders/route.ts`. Salió acá cuando
 * apareció un segundo camino de entrada —el agente de voz (ADR-13)— porque es
 * la pieza donde se cumple la regla que no se negocia: **lo que llega de
 * afuera son referencias (SKU, ids de opción, cantidad), nunca cifras.** El
 * precio, las promociones y el total se resuelven acá contra el catálogo de la
 * base. Si esto viviera duplicado en dos endpoints, RN-02 y RN-10 dejarían de
 * estar en un solo sitio y la segunda copia se quedaría atrás en silencio.
 *
 * La función es **pura** y no decide qué hacer con lo que salió mal: devuelve
 * las líneas que sí se pudieron armar y, aparte, tres listas de rechazos. Esa
 * separación existe porque los dos caminos necesitan lo contrario:
 *
 * - El **menú** descarta lo agotado y sigue. El cliente está mirando la
 *   pantalla: ve que el producto desapareció del carrito.
 * - La **voz** tiene que fallar entero. Un cliente que pidió tres cosas por
 *   teléfono y recibe dos no se enteró de nada, y nadie se lo avisó. El agente
 *   necesita la lista para poder decir "se me acabó la cerveza".
 */

export type RawLine = {
  sku: string;
  optionIds: number[];
  quantity: number;
};

export type BuiltLine = {
  productId: number;
  /** El nombre congelado, con la promoción que se aplicó entre paréntesis. */
  nameSnapshot: string;
  unitPrice: number;
  quantity: number;
  selectedOptions: { group: string; name: string; priceDelta: number }[];
  lineTotal: number;
};

export type BuildResult = {
  lines: BuiltLine[];
  subtotal: number;
  /** Nombres de productos que existen pero están agotados hoy. Van con nombre
   *  y no con SKU porque el agente de voz los tiene que decir en voz alta. */
  unavailable: string[];
  /** SKUs que no existen en el catálogo. */
  unknown: string[];
  /** Productos a los que les falta un grupo de personalización obligatorio.
   *  El menú lo impide en la pantalla; una llamada no tiene pantalla. */
  missingRequired: { name: string; group: string }[];
};

export type BuildOptions = {
  /** El instante contra el que se evalúan las promociones. */
  now?: Date;
  /**
   * Si un producto sin su grupo obligatorio se **rechaza** (la línea no entra)
   * o se cobra igual, solo anotándolo en `missingRequired`.
   *
   * El menú tiene que cobrarlo igual: el link `?add=SKU:2` que manda el bot no
   * trae opciones, y rechazarlo dejaría al cliente con un carrito vacío sin
   * saber por qué. La voz lo rechaza: si el agente no preguntó el término de la
   * carne, la comanda que llega a la parrilla no se puede preparar.
   */
  requireOptionGroups?: boolean;
};

export const MAX_ORDER_LINES = 20;
export const MAX_LINE_QUANTITY = 20;

/** Lee las líneas crudas de un cuerpo JSON sin confiar en nada: lo que no sea
 *  una referencia con forma válida se descarta antes de llegar al catálogo. */
export function parseRawLines(value: unknown): RawLine[] {
  if (!Array.isArray(value)) return [];

  const lines: RawLine[] = [];
  for (const raw of value.slice(0, MAX_ORDER_LINES)) {
    if (typeof raw !== "object" || raw === null) continue;
    const item = raw as { sku?: unknown; optionIds?: unknown; quantity?: unknown };

    if (typeof item.sku !== "string") continue;
    const quantity = Math.floor(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) continue;

    const optionIds = Array.isArray(item.optionIds)
      ? item.optionIds.filter((id): id is number => typeof id === "number")
      : [];

    lines.push({ sku: item.sku, optionIds, quantity });
  }
  return lines;
}

/**
 * `now` se recibe en vez de leerlo adentro para que todas las líneas de un
 * pedido se calculen contra el mismo instante: uno enviado a las 5:59:59 no
 * puede tener una línea dentro de la hora feliz y la siguiente fuera.
 */
export function buildOrderLines(
  catalog: CatalogCategory[],
  promotions: Promotion[],
  raw: RawLine[],
  options: BuildOptions = {},
): BuildResult {
  const now = options.now ?? new Date();
  const lines: BuiltLine[] = [];
  const unavailable: string[] = [];
  const unknown: string[] = [];
  const missingRequired: { name: string; group: string }[] = [];

  for (const item of raw.slice(0, MAX_ORDER_LINES)) {
    const product = findBySku(catalog, item.sku);
    if (!product) {
      unknown.push(item.sku);
      continue;
    }
    if (!product.available) {
      unavailable.push(product.name);
      continue;
    }

    const chosen = new Set(item.optionIds);
    const faltante = product.optionGroups.find(
      (g) => g.required && !g.options.some((o) => chosen.has(o.id)),
    );
    if (faltante) {
      missingRequired.push({ name: product.name, group: faltante.name });
      if (options.requireOptionGroups) continue;
    }

    const priced = priceLine(product, item.optionIds, item.quantity, promotions, now);
    const selectedOptions = resolveOptions(product, item.optionIds).map((o) => ({
      group: o.groupName,
      name: o.name,
      priceDelta: o.priceDelta,
    }));

    // El nombre congela también la promoción: dentro de un mes, quien mire este
    // pedido tiene que poder explicar por qué costó menos de lo que dice la
    // carta de hoy.
    const nameSnapshot = priced.promotion
      ? `${product.name} (${priced.promotion.name})`
      : product.name;

    lines.push({
      productId: product.id,
      nameSnapshot,
      unitPrice: priced.unitPrice,
      quantity: item.quantity,
      selectedOptions,
      lineTotal: priced.lineTotal,
    });
  }

  return {
    lines,
    subtotal: lines.reduce((sum, l) => sum + l.lineTotal, 0),
    unavailable,
    unknown,
    missingRequired,
  };
}

/** Un texto corto para explicarle a una persona qué no se pudo cobrar. Lo usa
 *  el endpoint de voz, que devuelve esto para que el agente lo diga. */
export function rejectionMessage(result: BuildResult): string | null {
  const partes: string[] = [];
  if (result.unavailable.length > 0) {
    partes.push(`no hay ${result.unavailable.join(", ")}`);
  }
  if (result.unknown.length > 0) {
    partes.push(`no existe ${result.unknown.join(", ")}`);
  }
  for (const m of result.missingRequired) {
    partes.push(`falta elegir ${m.group.toLowerCase()} para ${m.name}`);
  }
  return partes.length > 0 ? partes.join("; ") : null;
}
