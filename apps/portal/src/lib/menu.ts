import { formatCOP } from "@sistema/shared";

/**
 * El menú tal como lo administra el restaurante.
 *
 * Las formas siguen las tablas `categories`, `products`, `option_groups` y
 * `options` del esquema. Las promociones NO existen todavía en la base: su
 * forma aquí es la propuesta para cuando se conecten (ver STATUS.md).
 */

/**
 * El símbolo que identifica una categoría (en vez de un emoji). En la base es
 * la columna `categories.emoji`: al conectar, se guarda ahí el nombre del
 * símbolo.
 */
export const MENU_SYMBOLS = [
  { name: "burger", label: "Hamburguesa" },
  { name: "chicken", label: "Pollo" },
  { name: "fries", label: "Papas" },
  { name: "drink", label: "Bebida" },
  { name: "dessert", label: "Postre" },
  { name: "pizza", label: "Pizza" },
  { name: "hotdog", label: "Perro caliente" },
  { name: "star", label: "Especial" },
  { name: "plate", label: "Plato" },
] as const;

export type MenuSymbolName = (typeof MENU_SYMBOLS)[number]["name"];

export type MenuOption = { id: number; name: string; priceDelta: number };

export type MenuOptionGroup = {
  id: number;
  name: string;
  /** "single" = elige uno, "multi" = elige varios. */
  type: "single" | "multi";
  required: boolean;
  options: MenuOption[];
};

export type MenuProduct = {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  available: boolean;
  optionGroups: MenuOptionGroup[];
};

export type MenuCategory = {
  id: number;
  name: string;
  symbol: MenuSymbolName;
  /** Una categoría oculta no aparece en el menú público, con todo y productos. */
  active: boolean;
};

export type PromotionKind = "percent" | "price" | "2x1";

export type Promotion = {
  id: number;
  name: string;
  kind: PromotionKind;
  /** Porcentaje para `percent`, precio final para `price`. No aplica a 2x1. */
  value: number;
  scope: { type: "all" } | { type: "category"; ids: number[] } | { type: "products"; ids: number[] };
  /** 0 = domingo … 6 = sábado, como `Date.getDay()`. */
  days: number[];
  /** "HH:MM"; `null` en los dos = todo el día. */
  from: string | null;
  to: string | null;
  active: boolean;
};

export const DAY_LETTERS = ["D", "L", "M", "X", "J", "V", "S"];
const DAY_NAMES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function appliesTo(promo: Promotion, product: MenuProduct) {
  if (promo.scope.type === "all") return true;
  if (promo.scope.type === "category") return promo.scope.ids.includes(product.categoryId);
  return promo.scope.ids.includes(product.id);
}

/** Precio con la promoción aplicada; `null` si no cambia el precio (2x1). */
export function promoPrice(promo: Promotion, price: number) {
  if (promo.kind === "percent") return Math.round((price * (100 - promo.value)) / 100 / 100) * 100;
  if (promo.kind === "price") return Math.min(price, promo.value);
  return null;
}

export function promoValueLabel(promo: Promotion) {
  if (promo.kind === "percent") return `${promo.value}% de descuento`;
  if (promo.kind === "price") return `Precio especial ${formatCOP(promo.value)}`;
  return "2x1";
}

function formatHour(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "p.m." : "a.m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

/** "lun a vie, 3 p.m. a 6 p.m." */
export function scheduleLabel(promo: Promotion) {
  const days = [...promo.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  let dayText: string;
  if (days.length === 7) dayText = "Todos los días";
  else if (days.length === 0) dayText = "Ningún día";
  else {
    // Días seguidos (en orden de lunes a domingo) se leen como un rango.
    const order = days.map((d) => (d + 6) % 7);
    const consecutive = order.every((d, i) => i === 0 || d === order[i - 1] + 1);
    dayText =
      consecutive && days.length > 2
        ? `${DAY_NAMES[days[0]]} a ${DAY_NAMES[days[days.length - 1]]}`
        : days.map((d) => DAY_NAMES[d]).join(", ");
    dayText = dayText[0].toUpperCase() + dayText.slice(1);
  }
  const hours = promo.from && promo.to ? `, ${formatHour(promo.from)} a ${formatHour(promo.to)}` : "";
  return dayText + hours;
}
