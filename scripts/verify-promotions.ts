/**
 * Verifica el precio con promoción (RN-02) contra el catálogo real de Neon.
 *
 * Es el camino del dinero: lo que comprueba no es que "salga un número", sino
 * que el número del navegador y el del servidor sean el MISMO, porque los dos
 * llaman a `priceLine`. Si esa función se rompe, el cliente ve un total y paga
 * otro — y se entera después de pedir.
 *
 * Las promociones se arman acá a mano en vez de leerlas de la base: así el
 * resultado no depende de qué día se corra el script.
 */
import { getCatalog } from "../packages/shared/src/db/queries/catalog";
import { findBySku, priceLine } from "../packages/shared/src/domain/catalog";
import { formatCOP } from "../packages/shared/src/domain/format";
import {
  businessDay,
  isPromotionLive,
  type Promotion,
} from "../packages/shared/src/domain/promotions";

const ok = (label: string, cond: boolean) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) process.exitCode = 1;
};

const TODOS_LOS_DIAS = [0, 1, 2, 3, 4, 5, 6];

function promo(over: Partial<Promotion>): Promotion {
  return {
    id: 1,
    name: "Prueba",
    kind: "percent",
    value: 20,
    scope: { type: "all" },
    days: TODOS_LOS_DIAS,
    from: null,
    to: null,
    active: true,
    ...over,
  };
}

async function main() {
  const catalog = await getCatalog();
  const burger = findBySku(catalog, "BURGER-CLASICA")!;
  const papas = findBySku(catalog, "ACOMP-PAPAS")!;
  const hoy = businessDay();

  console.log("── Sin promociones ──");
  const plano = priceLine(burger, [], 2, []);
  ok(
    `2 × ${burger.name} = ${formatCOP(plano.lineTotal)} (precio lleno)`,
    plano.unitPrice === burger.price && plano.lineTotal === burger.price * 2,
  );

  console.log("\n── Porcentaje ──");
  const veinte = priceLine(burger, [], 1, [promo({ kind: "percent", value: 20 })]);
  ok(
    `20% sobre ${formatCOP(burger.price)} = ${formatCOP(veinte.unitPrice)}`,
    veinte.unitPrice === Math.round((burger.price * 0.8) / 100) * 100,
  );
  ok("guarda el precio sin descuento para tacharlo", veinte.fullUnitPrice === burger.price);

  console.log("\n── Precio fijo ──");
  const fijo = priceLine(papas, [], 3, [promo({ kind: "price", value: 5000 })]);
  ok(`3 × papas a $5.000 = ${formatCOP(fijo.lineTotal)}`, fijo.lineTotal === 15000);

  console.log("\n── 2x1: se cobran unidades, no se baja el precio unitario ──");
  const dosPorUno = promo({ kind: "2x1", value: 0 });
  const dos = priceLine(papas, [], 2, [dosPorUno]);
  const tres = priceLine(papas, [], 3, [dosPorUno]);
  const uno = priceLine(papas, [], 1, [dosPorUno]);
  ok(`el precio unitario NO cambia (${formatCOP(dos.unitPrice)})`, dos.unitPrice === papas.price);
  ok(`2 unidades se cobran como 1 = ${formatCOP(dos.lineTotal)}`, dos.lineTotal === papas.price);
  ok(`3 unidades se cobran como 2 = ${formatCOP(tres.lineTotal)}`, tres.lineTotal === papas.price * 2);
  ok(`1 unidad se cobra completa = ${formatCOP(uno.lineTotal)}`, uno.lineTotal === papas.price);

  console.log("\n── El descuento va sobre el producto, no sobre las opciones ──");
  const extras = burger.optionGroups.find((g) => g.name === "Extras");
  const tocineta = extras?.options.find((o) => o.priceDelta > 0);
  if (tocineta) {
    const conExtra = priceLine(burger, [tocineta.id], 1, [promo({ kind: "percent", value: 20 })]);
    const baseConDescuento = Math.round((burger.price * 0.8) / 100) * 100;
    ok(
      `${burger.name} + ${tocineta.name} = ${formatCOP(conExtra.unitPrice)} (el extra no se descuenta)`,
      conExtra.unitPrice === baseConDescuento + tocineta.priceDelta,
    );
  } else {
    console.log("  (sin opciones con recargo en el catálogo; nada que comprobar)");
  }

  console.log("\n── Una promoción que no corre hoy no descuenta ──");
  const otroDia = promo({ days: [(hoy + 3) % 7] });
  const sinDescuento = priceLine(burger, [], 1, [otroDia]);
  ok("precio lleno cuando la promo es de otro día", sinDescuento.unitPrice === burger.price);
  ok("y no se reporta ninguna promoción aplicada", sinDescuento.promotion === null);

  const pausada = promo({ active: false });
  ok(
    "una promoción pausada tampoco descuenta",
    priceLine(burger, [], 1, [pausada]).unitPrice === burger.price,
  );

  console.log("\n── Fuera de la franja horaria ──");
  const manana = new Date();
  manana.setHours(10, 0, 0, 0);
  const horaFeliz = promo({ from: "15:00", to: "18:00", days: TODOS_LOS_DIAS });
  const tarde = new Date();
  tarde.setHours(16, 0, 0, 0);
  ok(
    "a las 10 a.m. la hora feliz no corre",
    !isPromotionLive(horaFeliz, manana) && priceLine(burger, [], 1, [horaFeliz], manana).promotion === null,
  );
  ok(
    "a las 4 p.m. sí corre",
    isPromotionLive(horaFeliz, tarde) && priceLine(burger, [], 1, [horaFeliz], tarde).promotion !== null,
  );

  console.log("\n── Entre dos promociones, gana la que más le conviene al cliente ──");
  const dosPromos = [
    promo({ id: 1, name: "10%", kind: "percent", value: 10 }),
    promo({ id: 2, name: "30%", kind: "percent", value: 30 }),
  ];
  const mejor = priceLine(burger, [], 1, dosPromos);
  ok(`aplica la del 30% (${formatCOP(mejor.unitPrice)})`, mejor.promotion?.name === "30%");
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
