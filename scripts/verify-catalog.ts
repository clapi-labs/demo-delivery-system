/**
 * Verifica getCatalog() contra la base real: no solo que compile, que la
 * forma armada (categorías -> productos -> grupos -> opciones) sea correcta.
 */
import { getCatalog } from "../packages/shared/src/db/queries/catalog";
import { searchProducts, flatten, findBySku } from "../packages/shared/src/domain/catalog";

const ok = (label: string, cond: boolean) => console.log(`${cond ? "✓" : "✗"} ${label}`);

async function main() {
  const catalog = await getCatalog();

  ok("5 categorías activas", catalog.length === 5);
  ok(
    "25 productos en total",
    flatten(catalog).length === 25,
  );

  const burger = findBySku(catalog, "BURGER-DOBLE");
  ok("encuentra por SKU", burger?.name === "Doble Tocineta");
  ok("trae grupos de opciones", (burger?.optionGroups.length ?? 0) > 0);

  const termino = burger?.optionGroups.find((g) => g.name === "Término de la carne");
  ok("grupo obligatorio tiene sus 3 opciones", termino?.options.length === 3);
  ok("grupo es de tipo single", termino?.type === "single");

  const cerveza = findBySku(catalog, "BEB-CERVEZA");
  ok("producto agotado sigue en el catálogo", cerveza !== undefined);
  ok("producto agotado marca available=false", cerveza?.available === false);

  const results = searchProducts(catalog, "limón");
  ok(`busca con tilde ("limón" -> ${results.length} resultado(s))`, results.length > 0);
  ok(
    "resultado esperado en la búsqueda",
    results.some((p) => p.name.toLowerCase().includes("limonada")),
  );

  const categoriesWithProducts = catalog.every((c) => c.products.length > 0);
  ok("ninguna categoría queda vacía", categoriesWithProducts);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
