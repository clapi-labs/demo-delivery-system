/**
 * Verifica los dos endpoints que conectan el agente de voz con este sistema
 * (RF-56, RF-57, ADR-13) contra la base real:
 *
 *   GET  /api/internal/catalog
 *   POST /api/internal/voice-order
 *
 * Mismo patrón que `verify-menu-order.ts`: se llama a los handlers directo,
 * sin levantar Next, y se limpia lo que se creó al terminar.
 *
 * Qué se comprueba, y por qué esas cosas y no otras — son las que se rompen en
 * silencio y solo se notan cuando un cliente ya colgó el teléfono:
 *
 *  - Que el precio lo ponga el servidor y no el agente (RN-02, RN-14).
 *  - Que **la misma llamada dos veces no cree dos comandas** en la parrilla.
 *  - Que un producto agotado haga fallar el pedido entero, con la lista, en vez
 *    de entregarle al cliente dos de las tres cosas que pidió.
 *  - Que el secreto sirva de algo: sin él, esa URL crea pedidos.
 */
process.env.INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "TEST_INTERNAL_SECRET";

import { eq } from "drizzle-orm";

import { orderItems, orders, products } from "../packages/shared/src/db";
import { db } from "../packages/shared/src/db/client";
import { getCatalog } from "../packages/shared/src/db/queries/catalog";
import { getPromotions } from "../packages/shared/src/db/queries/promotions";
import { priceLine } from "../packages/shared/src/domain/catalog";

const ok = (label: string, cond: boolean) => console.log(`${cond ? "✓" : "✗"} ${label}`);
const SECRET = process.env.INTERNAL_SECRET!;

type VoiceResponse = {
  code?: string;
  subtotal?: number;
  total?: number;
  deliveryFee?: number;
  duplicated?: boolean;
  notified?: boolean;
  unavailable?: string[];
  missingRequired?: { name: string; group: string }[];
  reason?: string;
};

async function main() {
  const { POST } = await import("../apps/menu/src/app/api/internal/voice-order/route");
  const { GET: CATALOG } = await import("../apps/menu/src/app/api/internal/catalog/route");

  const catalog = await getCatalog();
  const promotions = await getPromotions();
  const todos = catalog.flatMap((c) => c.products);

  // Un producto sin grupos obligatorios, para las pruebas que no van sobre eso.
  const simple = todos.find(
    (p) => p.available && !p.optionGroups.some((g) => g.required),
  )!;
  const conObligatorio = todos.find(
    (p) => p.available && p.optionGroups.some((g) => g.required && g.options.length > 0),
  );

  const codes: string[] = [];
  let callSeq = 0;
  const nextCallId = () => `verify-${Date.now()}-${++callSeq}`;

  const post = (body: Record<string, unknown>, secret = SECRET) =>
    POST(
      new Request("http://localhost/api/internal/voice-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify({
          callId: nextCallId(),
          customerName: "Cliente de prueba por voz",
          address: "Calle 10 #20-30, barrio Centro",
          paymentMethod: "efectivo",
          ...body,
        }),
      }),
    );

  console.log("── El catálogo que lee el agente ──");
  const catRes = await CATALOG(
    new Request("http://localhost/api/internal/catalog", {
      headers: { Authorization: `Bearer ${SECRET}` },
    }),
  );
  const cat = (await catRes.json()) as {
    business?: { name?: string; deliveryFee?: number };
    categories?: { products: { sku: string; priceNow: number; available: boolean }[] }[];
  };
  const catProductos = (cat.categories ?? []).flatMap((c) => c.products);
  ok("200 con el secreto", catRes.status === 200);
  ok("trae el negocio y su domicilio", Boolean(cat.business?.name && cat.business?.deliveryFee));
  ok("trae todos los productos del catálogo", catProductos.length === todos.length);
  ok(
    "manda también los agotados, para poder decir 'hoy no hay'",
    catProductos.some((p) => !p.available) === todos.some((p) => !p.available),
  );
  const esperado = priceLine(simple, [], 1, promotions, new Date()).unitPrice;
  ok(
    "el precio de hoy lo resuelve el servidor (RN-10)",
    catProductos.find((p) => p.sku === simple.sku)?.priceNow === esperado,
  );

  const sinSecreto = await CATALOG(new Request("http://localhost/api/internal/catalog"));
  ok("401 sin el secreto", sinSecreto.status === 401);

  console.log("\n── Un pedido normal entra como comanda nueva ──");
  const r1 = await post({ items: [{ sku: simple.sku, optionIds: [], quantity: 2, unitPrice: 1 }] });
  const b1 = (await r1.json()) as VoiceResponse;
  if (b1.code) codes.push(b1.code);
  const [o1] = await db.select().from(orders).where(eq(orders.code, b1.code!));
  const precio1 = priceLine(simple, [], 2, promotions, new Date());
  ok("201 con código", r1.status === 201 && Boolean(b1.code));
  ok("entra como 'Nuevo', no como borrador", o1?.status === "pending");
  ok("queda marcado source='call' (auditable)", o1?.source === "call");
  ok("guarda el id de la llamada", Boolean(o1?.sourceRef));
  ok("no queda esperando un canje (redeemedAt puesto)", o1?.redeemedAt !== null);
  ok(
    "ignora el precio que mandó el agente; usa el del catálogo (RN-02, RN-14)",
    o1?.subtotal === precio1.lineTotal,
  );
  ok(
    "el total suma el domicilio",
    o1?.total === precio1.lineTotal + (o1?.deliveryFee ?? -1),
  );
  ok("el total de la respuesta es el que quedó guardado", b1.total === o1?.total);
  const items1 = await db.select().from(orderItems).where(eq(orderItems.orderId, o1!.id));
  ok("crea el renglón de la comanda", items1.length === 1 && items1[0].quantity === 2);

  console.log("\n── La misma llamada dos veces no duplica la comanda ──");
  const callId = nextCallId();
  const r2a = await post({ callId, items: [{ sku: simple.sku, optionIds: [], quantity: 1 }] });
  const b2a = (await r2a.json()) as VoiceResponse;
  if (b2a.code) codes.push(b2a.code);
  const r2b = await post({ callId, items: [{ sku: simple.sku, optionIds: [], quantity: 5 }] });
  const b2b = (await r2b.json()) as VoiceResponse;
  ok("el segundo intento devuelve 200, no 201", r2b.status === 200);
  ok("devuelve el MISMO pedido", b2b.code === b2a.code);
  ok("lo dice explícitamente (duplicated)", b2b.duplicated === true);
  const repetidos = await db.select().from(orders).where(eq(orders.sourceRef, callId));
  ok("hay una sola comanda en la base", repetidos.length === 1);

  console.log("\n── Un producto agotado hace fallar el pedido ENTERO ──");
  // Se agota un producto de verdad y se devuelve al final: es la única forma de
  // comprobar el camino que el agente tiene que saber explicar.
  const victima = todos.find((p) => p.available && p.sku !== simple.sku)!;
  await db.update(products).set({ available: false }).where(eq(products.sku, victima.sku));
  try {
    const r3 = await post({
      items: [
        { sku: simple.sku, optionIds: [], quantity: 1 },
        { sku: victima.sku, optionIds: [], quantity: 1 },
      ],
    });
    const b3 = (await r3.json()) as VoiceResponse;
    ok("422, no 201", r3.status === 422);
    ok("nombra lo que no hay, para poder decirlo en voz alta", b3.unavailable?.includes(victima.name) === true);
    ok("no crea nada a medias", b3.code === undefined);
  } finally {
    await db.update(products).set({ available: true }).where(eq(products.sku, victima.sku));
  }

  console.log("\n── Sin el término de la carne no se manda a la parrilla ──");
  if (conObligatorio) {
    const r4 = await post({ items: [{ sku: conObligatorio.sku, optionIds: [], quantity: 1 }] });
    const b4 = (await r4.json()) as VoiceResponse;
    ok("422 si falta un grupo obligatorio", r4.status === 422);
    ok(
      "dice qué preguntar",
      b4.missingRequired?.some((m) => m.name === conObligatorio.name) === true,
    );

    // Se elige una opción de **cada** grupo obligatorio: un producto puede
    // tener más de uno (término de la carne y punto del pan, por ejemplo) y
    // llenar solo el primero sigue dejando la comanda incompleta.
    const obligatorios = conObligatorio.optionGroups.filter(
      (g) => g.required && g.options.length > 0,
    );
    const grupo = obligatorios[0];
    const r5 = await post({
      items: [
        {
          sku: conObligatorio.sku,
          optionIds: obligatorios.map((g) => g.options[0].id),
          quantity: 1,
        },
      ],
    });
    const b5 = (await r5.json()) as VoiceResponse;
    if (b5.code) codes.push(b5.code);
    ok("con la opción elegida sí entra", r5.status === 201);
    const [o5] = await db.select().from(orders).where(eq(orders.code, b5.code!));
    const items5 = await db.select().from(orderItems).where(eq(orderItems.orderId, o5!.id));
    ok(
      "la opción queda en el renglón, para que la cocina la lea",
      (items5[0]?.selectedOptions as { name: string }[] | null)?.some(
        (o) => o.name === grupo.options[0].name,
      ) === true,
    );
  } else {
    console.log("  (sin productos con grupo obligatorio en el catálogo: no aplica)");
  }

  console.log("\n── Lo que no se puede tomar por teléfono ──");
  const r6 = await post({ items: [] });
  ok("400 con el pedido vacío", r6.status === 400);
  const r7 = await post({ items: [{ sku: simple.sku, optionIds: [], quantity: 1 }], address: null });
  ok("400 sin dirección: nadie puede llevar eso", r7.status === 400);
  const r8 = await post({ callId: null, items: [{ sku: simple.sku, optionIds: [], quantity: 1 }] });
  ok("400 sin callId: sin él no hay idempotencia", r8.status === 400);
  const r9 = await post(
    { items: [{ sku: simple.sku, optionIds: [], quantity: 1 }] },
    "SECRETO-EQUIVOCADO",
  );
  ok("401 con un secreto inválido", r9.status === 401);

  console.log("\n── El teléfono puede faltar: la llamada web no trae número ──");
  const r10 = await post({
    items: [{ sku: simple.sku, optionIds: [], quantity: 1 }],
    phone: "",
  });
  const b10 = (await r10.json()) as VoiceResponse;
  if (b10.code) codes.push(b10.code);
  ok("el pedido se toma igual", r10.status === 201);
  ok("y avisa que no se pudo encolar el WhatsApp", b10.notified === false);

  for (const code of codes) {
    const [row] = await db.select({ id: orders.id }).from(orders).where(eq(orders.code, code));
    if (row) {
      await db.delete(orderItems).where(eq(orderItems.orderId, row.id));
      await db.delete(orders).where(eq(orders.id, row.id));
    }
  }
  console.log(`\nLimpieza: ${codes.length} pedidos de prueba borrados.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
