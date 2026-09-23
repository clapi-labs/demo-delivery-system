import type { StaticImageData } from "next/image";

import burger from "@/assets/food-burger.jpg";
import combo from "@/assets/food-combo.jpg";
import dessert from "@/assets/food-dessert.jpg";
import drinks from "@/assets/food-drinks.jpg";
import fries from "@/assets/food-fries.jpg";
import hotdog from "@/assets/food-hotdog.jpg";

/**
 * Fotos de relleno del prototipo de diseño (`prototipo_menu_app/`), una por
 * categoría, mientras no haya foto real de cada producto (`imageUrl` en el
 * catálogo). El día que el negocio suba sus propias fotos, `imageUrl` deja de
 * ser `null` y esta función ya no se usa para ese producto.
 */
const BY_CATEGORY_SLUG: Record<string, StaticImageData> = {
  hamburguesas: burger,
  pollo: hotdog,
  acompanamientos: fries,
  bebidas: drinks,
  postres: dessert,
};

export function categoryImage(slug: string): StaticImageData {
  return BY_CATEGORY_SLUG[slug] ?? combo;
}
