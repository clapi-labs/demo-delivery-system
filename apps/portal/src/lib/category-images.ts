import type { StaticImageData } from "next/image";

import burger from "@/assets/food-burger.jpg";
import combo from "@/assets/food-combo.jpg";
import dessert from "@/assets/food-dessert.jpg";
import drinks from "@/assets/food-drinks.jpg";
import fries from "@/assets/food-fries.jpg";
import hotdog from "@/assets/food-hotdog.jpg";

/**
 * Las MISMAS fotos por categoría que usa el menú público
 * (`apps/menu/src/lib/category-images.ts`), para que el restaurante vea en su
 * Menú lo que ve el cliente en el suyo.
 *
 * Están copiadas y no compartidas desde `packages/shared` a propósito: son
 * importaciones estáticas de Next (`next/image` las optimiza y les calcula el
 * tamaño en compilación), y eso solo funciona dentro de una app. El precio de
 * duplicarlas es medio mega en el repositorio; el de compartirlas sería servir
 * las fotos de una app desde la otra por URL absoluta, que se rompe en cada
 * despliegue de vista previa.
 *
 * Son de relleno: el día que un producto tenga su `imageUrl` propia, esta
 * función deja de usarse para ese producto.
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
