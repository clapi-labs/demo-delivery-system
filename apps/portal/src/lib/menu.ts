/**
 * El menú tal como lo administra el restaurante.
 *
 * Las formas siguen las tablas `categories`, `products`, `option_groups` y
 * `options` del esquema.
 *
 * Las promociones ya NO viven acá: su forma y sus reglas (a qué aplica, qué
 * precio deja, qué días corre) están en `@sistema/shared`, porque el menú
 * público y el bot necesitan exactamente las mismas. Se reexportan para que
 * las pantallas sigan importando de un solo sitio.
 */

export {
  DAY_LETTERS,
  appliesTo,
  promoPrice,
  promoValueLabel,
  scheduleLabel,
  type Promotion,
  type PromotionKind,
} from "@sistema/shared";

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
  /** `categories.slug`. Elige el símbolo y la foto de relleno de la categoría. */
  slug: string;
  name: string;
  symbol: MenuSymbolName;
  /** Una categoría oculta no aparece en el menú público, con todo y productos. */
  active: boolean;
};
