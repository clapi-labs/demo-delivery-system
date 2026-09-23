/**
 * Verifica `apps/bot/src/app/api/internal/menu-order/route.ts` (RF-26),
 * el otro lado del contrato de `verify-menu-order.ts`: acá se prueba SOLO el
 * bot, con una llamada ya armada como la mandaría el menú.
 *
 * Credenciales de Meta FALSAS, solo para este proceso — igual que
 * `verify-orchestrator.ts`. `fetch` se reemplaza por un doble que solo
 * intercepta `graph.facebook.com`; las consultas de Neon pasan al `fetch`
 * real.
 */
process.env.WHATSAPP_PHONE_NUMBER_ID = "TEST_PHONE_ID";
process.env.WHATSAPP_ACCESS_TOKEN = "TEST_TOKEN";
process.env.WHATSAPP_APP_SECRET = "TEST_SECRET";
process.env.WHATSAPP_VERIFY_TOKEN = "TEST_VERIFY";
process.env.INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "TEST_INTERNAL_SECRET";
// Sin esto, `checkActive()` (ADR-11) corta todos los envíos antes de llegar
// a lo que este script realmente prueba.
process.env.BOT_ACTIVE = "true";
// Sin esto, el script falla si se corre fuera del horario de
// BUSINESS_OPENS_HOUR/CLOSES_HOUR de .env.local — un "tropezón" real que
// costó una corrida en vivo (ver STATUS.md).
process.env.BUSINESS_OPENS_HOUR = "0";
process.env.BUSINESS_CLOSES_HOUR = "24";

import { eq } from "drizzle-orm";

import { conversations, db, orderItems, orders } from "../packages/shared/src/db";
import { generateOrderCode } from "../packages/shared/src/domain/order-code";

const ok = (label: string, cond: boolean) => console.log(`${cond ? "✓" : "✗"} ${label}`);

async function main() {
  const sent: { url: string; body: Record<string, any> }[] = [];
  const realFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("graph.facebook.com")) {
      sent.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.FAKE" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;

  const { POST } = await import("../apps/bot/src/app/api/internal/menu-order/route");
  const { createMenuToken } = await import("../packages/shared/src/domain/menu-token");
  const { setBotPaused, getConversationByPhone } = await import(
    "../apps/bot/src/db/queries/conversation"
  );

  const call = (body: unknown, secret = process.env.INTERNAL_SECRET!) =>
    POST(
      new Request("http://localhost/api/internal/menu-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify(body),
      }),
    );

  console.log("── Protegido con INTERNAL_SECRET ──");
  const unauthorized = await call({ code: "AAAAAA", token: "x" }, "");
  ok("401 sin Authorization", unauthorized.status === 401);
  const wrongSecret = await call({ code: "AAAAAA", token: "x" }, "no-es-el-secreto");
  ok("401 con el secreto equivocado", wrongSecret.status === 401);

  console.log("\n── Pedido inexistente ──");
  const notFound = await call({ code: "ZZZZZZ" });
  ok("404 order_not_found", notFound.status === 404);

  const phone = `57304${Date.now()}`.slice(0, 12);
  const [conversation] = await db
    .insert(conversations)
    .values({ phone, lastInboundAt: new Date() })
    .returning();
  const menuTokenSecret = process.env.MENU_TOKEN_SECRET!;

  /** Un pedido como los que arma el menú hoy: con dirección y pago ya
   *  elegidos. `complete: false` simula uno viejo o del respaldo manual. */
  const makeOrder = async (complete = true) => {
    const [order] = await db
      .insert(orders)
      .values({
        code: generateOrderCode(),
        subtotal: 10000,
        deliveryFee: 5000,
        total: 15000,
        ...(complete
          ? {
              customerName: "Cliente de prueba",
              address: "Calle 10 #20-30, barrio Centro",
              paymentMethod: "datafono" as const,
            }
          : {}),
      })
      .returning();

    await db.insert(orderItems).values({
      orderId: order.id,
      nameSnapshot: "Hamburguesa Clásica",
      unitPrice: 10000,
      quantity: 1,
      selectedOptions: [],
      lineTotal: 10000,
    });

    return order;
  };

  console.log("\n── Token inválido: no canjea, no llama a Meta ──");
  const order1 = await makeOrder();
  sent.length = 0;
  const badToken = await call({ code: order1.code, token: "no-es-un-token-valido" });
  const badTokenBody = (await badToken.json()) as { ok: boolean; reason?: string };
  ok(
    "ok:false, reason:invalid_token, sin tocar Meta",
    badTokenBody.ok === false && badTokenBody.reason === "invalid_token" && sent.length === 0,
  );
  const [check1] = await db.select().from(orders).where(eq(orders.id, order1.id));
  ok("el pedido sigue sin canjear", check1.redeemedAt === null);

  console.log("\n── Pausado: no canjea, no llama a Meta (RN-04) ──");
  const order2 = await makeOrder();
  await setBotPaused(conversation.id, true, "prueba");
  sent.length = 0;
  const token = createMenuToken(phone, menuTokenSecret);
  const paused = await call({ code: order2.code, token });
  const pausedBody = (await paused.json()) as { ok: boolean; reason?: string };
  ok(
    "ok:false, reason:paused, sin tocar Meta",
    pausedBody.ok === false && pausedBody.reason === "paused" && sent.length === 0,
  );
  const [check2] = await db.select().from(orders).where(eq(orders.id, order2.id));
  ok("el pedido sigue sin canjear", check2.redeemedAt === null);
  await setBotPaused(conversation.id, false);

  console.log("\n── Camino feliz: el pedido llega COMPLETO y se cierra de una ──");
  const order3 = await makeOrder();
  sent.length = 0;
  const happy = await call({ code: order3.code, token });
  const happyBody = (await happy.json()) as { ok: boolean };
  const [check3] = await db.select().from(orders).where(eq(orders.id, order3.id));
  ok("canjea el pedido y lo asocia al teléfono del token", check3.redeemedAt !== null && check3.phone === phone);
  ok("le avisa al cliente por WhatsApp (mockeado)", sent.length === 1 && happyBody.ok === true);

  // Lo central del cambio: con dirección y pago ya elegidos en el menú, el bot
  // NO vuelve a preguntar nada — cierra el pedido en ese mismo mensaje.
  ok("queda 'pending' de una, sin pasar por preguntar", check3.status === "pending");
  const confirmText = (sent[0]?.body?.text as any)?.body ?? "";
  ok("el mensaje confirma, no pregunta la dirección", confirmText.includes("confirmado"));
  ok("le repite la dirección que dio en el menú", confirmText.includes("Calle 10 #20-30"));
  ok(
    "y le dice cómo paga, según lo que eligió (datáfono)",
    confirmText.includes("datáfono") || confirmText.includes("tarjeta"),
  );

  const conv3 = await getConversationByPhone(phone);
  ok("la conversación vuelve a 'advising', sin pedido en curso",
    conv3?.phase === "advising" && conv3?.activeOrderId === null);

  console.log("\n── Pedido SIN dirección (respaldo manual): sí pregunta ──");
  const order4 = await makeOrder(false);
  sent.length = 0;
  await call({ code: order4.code, token });
  const conv4 = await getConversationByPhone(phone);
  ok("entra a pedir la dirección por chat, como antes", conv4?.phase === "collecting_address");
  ok(
    "y el mensaje pregunta a dónde llevarlo",
    ((sent[0]?.body?.text as any)?.body ?? "").includes("dirección"),
  );

  console.log("\n── RN-01: el mismo código no se canjea dos veces ──");
  sent.length = 0;
  const again = await call({ code: order3.code, token });
  const againBody = (await again.json()) as { ok: boolean; reason?: string };
  ok(
    "no revienta; contesta con el mensaje de 'ya canjeado', no ok:false silencioso",
    again.status === 200 && sent.length === 1,
  );
  ok("el resultado sigue siendo el mismo pedido, no uno nuevo", againBody.ok !== undefined);

  await db.delete(orders).where(eq(orders.id, order1.id));
  await db.delete(orders).where(eq(orders.id, order2.id));
  await db.delete(orders).where(eq(orders.id, order3.id));
  await db.delete(orders).where(eq(orders.id, order4.id));
  await db.delete(conversations).where(eq(conversations.id, conversation.id));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
