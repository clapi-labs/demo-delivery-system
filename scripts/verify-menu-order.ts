/**
 * Verifica `apps/menu/src/app/api/orders/route.ts` (RF-24, RF-26, RF-27)
 * contra la base real. `fetch` se reemplaza por un doble que solo intercepta
 * la llamada al bot (`BOT_URL`); todo lo demás —las consultas de Neon— pasa
 * al `fetch` real, por la misma razón documentada en
 * `verify-window-guard.ts`: el driver HTTP de Neon también usa `fetch`.
 */
process.env.BOT_URL = "http://TEST_BOT_URL_NO_USADO";
process.env.INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "TEST_INTERNAL_SECRET";

import { eq } from "drizzle-orm";

import { orders } from "../packages/shared/src/db";
import { db } from "../packages/shared/src/db/client";
import { getCatalog } from "../packages/shared/src/db/queries/catalog";

const ok = (label: string, cond: boolean) => console.log(`${cond ? "✓" : "✗"} ${label}`);

async function main() {
  let botNotified = false;
  let botOkResponse = true;
  const realFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("TEST_BOT_URL_NO_USADO")) {
      botNotified = true;
      return new Response(JSON.stringify({ ok: botOkResponse }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;

  const { POST } = await import("../apps/menu/src/app/api/orders/route");
  const { createMenuToken } = await import("../packages/shared/src/domain/menu-token");

  const catalog = await getCatalog();
  const product = catalog.flatMap((c) => c.products).find((p) => p.available)!;
  const withOptions = catalog
    .flatMap((c) => c.products)
    .find((p) => p.available && p.optionGroups.some((g) => g.options.length > 0));

  const post = (body: unknown) =>
    POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

  const codes: string[] = [];

  console.log("── RN-02: el precio se recalcula contra el catálogo ──");
  botNotified = false;
  botOkResponse = true;
  const token = createMenuToken("573000000001", process.env.MENU_TOKEN_SECRET!);
  const res1 = await post({
    items: [{ sku: product.sku, optionIds: [], quantity: 3, unitPrice: 1 }],
    token,
  });
  const body1 = (await res1.json()) as { code: string; delivered: boolean };
  codes.push(body1.code);
  const [order1] = await db.select().from(orders).where(eq(orders.code, body1.code));
  ok("201 con un código", res1.status === 201 && Boolean(body1.code));
  ok(
    "ignora el precio que mandó el cliente; usa el del catálogo",
    order1.subtotal === product.price * 3,
  );
  ok("queda 'draft' y sin canjear — solo el bot canjea (ADR-02)", order1.status === "draft" && order1.redeemedAt === null);
  ok("con token válido, avisa al bot", botNotified);
  ok("delivered refleja lo que respondió el bot", body1.delivered === true);

  if (withOptions) {
    console.log("\n── Las opciones eligen bien la línea ──");
    const groupWithOptions = withOptions.optionGroups.find((g) => g.options.length > 0)!;
    const option = groupWithOptions.options[0];
    botNotified = false;
    const res2 = await post({
      items: [{ sku: withOptions.sku, optionIds: [option.id], quantity: 1 }],
      token: null,
    });
    const body2 = (await res2.json()) as { code: string; delivered: boolean };
    codes.push(body2.code);
    const [order2] = await db.select().from(orders).where(eq(orders.code, body2.code));
    ok(
      "el total incluye el precio de la opción elegida",
      order2.subtotal === withOptions.price + option.priceDelta,
    );
  } else {
    console.log("\n(sin productos con opciones en el catálogo semilla — se omite ese caso)");
  }

  console.log("\n── Sin token: se crea igual, para el respaldo #PEDIDO (RF-27) ──");
  botNotified = false;
  const res3 = await post({ items: [{ sku: product.sku, optionIds: [], quantity: 1 }], token: null });
  const body3 = (await res3.json()) as { code: string; delivered: boolean };
  codes.push(body3.code);
  ok("se crea el pedido", res3.status === 201);
  ok("no avisa al bot sin token", !botNotified);
  ok("delivered:false", body3.delivered === false);

  console.log("\n── Si el bot no puede confirmar, delivered:false pero el pedido queda ──");
  botOkResponse = false;
  const res4 = await post({ items: [{ sku: product.sku, optionIds: [], quantity: 1 }], token });
  const body4 = (await res4.json()) as { code: string; delivered: boolean };
  codes.push(body4.code);
  ok("delivered:false, no revienta (RF-17 aplicado al menú)", res4.status === 201 && body4.delivered === false);

  console.log("\n── Un SKU inexistente o agotado se descarta, no revienta el pedido ──");
  const res5 = await post({
    items: [
      { sku: "SKU-QUE-NO-EXISTE", optionIds: [], quantity: 1 },
      { sku: product.sku, optionIds: [], quantity: 1 },
    ],
    token: null,
  });
  const body5 = (await res5.json()) as { code: string };
  codes.push(body5.code);
  const [order5] = await db.select().from(orders).where(eq(orders.code, body5.code));
  ok("solo cuenta la línea válida", order5.subtotal === product.price);

  console.log("\n── Carrito vacío o todo inválido: 400, no crea nada ──");
  const res6 = await post({ items: [], token: null });
  ok("400 con carrito vacío", res6.status === 400);
  const res7 = await post({ items: [{ sku: "NO-EXISTE", optionIds: [], quantity: 1 }], token: null });
  ok("400 si ningún producto es válido", res7.status === 400);

  for (const code of codes) {
    await db.delete(orders).where(eq(orders.code, code));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
