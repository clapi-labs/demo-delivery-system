/**
 * El carrito (RF-21).
 *
 * Lo que se guarda es deliberadamente mínimo: SKU, opciones elegidas y
 * cantidad. Ningún precio ni nombre se persiste — se resuelven contra el
 * catálogo al pintar (`resolveOptions`/`unitPriceWithOptions` en
 * `@sistema/shared`).
 *
 * Un carrito que guarda precios es un carrito manipulable desde el navegador,
 * y además queda desactualizado en silencio si el catálogo cambia.
 */

export type CartItem = {
  sku: string;
  optionIds: number[];
  quantity: number;
};

const STORAGE_KEY = "menu-cart-v1";

/** Dos líneas son la "misma" si tienen el mismo SKU y las mismas opciones —
 *  eso es lo que permite que "hamburguesa con queso" y "hamburguesa sin
 *  queso" sean renglones distintos en vez de sumarse entre sí. */
export function cartLineKey(sku: string, optionIds: number[]): string {
  return `${sku}::${[...optionIds].sort((a, b) => a - b).join(",")}`;
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CartItem).sku === "string" &&
        Array.isArray((item as CartItem).optionIds) &&
        typeof (item as CartItem).quantity === "number",
    );
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Parsea `?add=SKU:cant,SKU:cant` (`bot/menu-link.ts`). Cantidades inválidas
 *  o SKUs vacíos se ignoran en silencio: un link mal formado no debe romper
 *  la carga del menú. */
export function parseAddParam(add: string | null | undefined): CartItem[] {
  if (!add) return [];
  return add
    .split(",")
    .map((entry) => {
      const [sku, qtyRaw] = entry.split(":");
      const quantity = Number(qtyRaw);
      if (!sku || !Number.isFinite(quantity) || quantity <= 0) return null;
      return { sku, optionIds: [] as number[], quantity: Math.floor(quantity) };
    })
    .filter((item): item is CartItem => item !== null);
}
