/**
 * Verifica el motor del asistente contra la base real: la máquina de estados
 * del pedido, el candado (RF-16), las puertas deterministas y qué tipo de
 * mensaje se manda según la forma de la respuesta.
 *
 * Credenciales de Meta FALSAS, solo para este proceso — nunca en .env.local,
 * que es donde van las reales cuando lleguen. `fetch` se reemplaza por un
 * doble que nunca toca la red: confirma qué se habría mandado sin depender de
 * Internet ni de un token válido.
 */
process.env.WHATSAPP_PHONE_NUMBER_ID = "TEST_PHONE_ID";
process.env.WHATSAPP_ACCESS_TOKEN = "TEST_TOKEN";
process.env.WHATSAPP_APP_SECRET = "TEST_SECRET";
process.env.WHATSAPP_VERIFY_TOKEN = "TEST_VERIFY";
// Sin esto, `checkActive()` (ADR-11) corta todos los envíos antes de llegar
// a lo que este script realmente prueba.
process.env.BOT_ACTIVE = "true";
// Sin esto, el script falla si se corre fuera del horario de
// BUSINESS_OPENS_HOUR/CLOSES_HOUR de .env.local — un "tropezón" real
// descubierto corriendo la suite pasadas las 10 p.m. (ver STATUS.md).
process.env.BUSINESS_OPENS_HOUR = "0";
process.env.BUSINESS_CLOSES_HOUR = "24";

import { eq } from "drizzle-orm";

import { conversations, db, orderItems, orders } from "../packages/shared/src/db";
import { generateOrderCode } from "../packages/shared/src/domain/order-code";

const ok = (label: string, cond: boolean) => console.log(`${cond ? "✓" : "✗"} ${label}`);

type Sent = { url: string; body: Record<string, unknown> };

async function main() {
  // Este script prueba el MOTOR, no las APIs externas — por eso `fetch` nunca
  // toca Meta ni OpenAI de verdad (OpenAI ya se prueba con la API real en
  // `verify-advisor.ts`). El mock distingue por host: a WhatsApp le responde
  // como si el mensaje se hubiera enviado; a OpenAI le simula que el modelo
  // eligió la herramienta `reply`.
  //
  // TODO LO DEMÁS pasa al `fetch` real, sin excepción. El driver HTTP de Neon
  // (`@neondatabase/serverless`) también usa `fetch` para hablar con la
  // base — interceptarlo por accidente (como hacía la primera versión de este
  // mock, que trataba "todo lo que no es OpenAI" como si fuera WhatsApp)
  // corrompe cada INSERT/SELECT con una respuesta que no tiene la forma que
  // Neon espera. Se descubrió corriendo esto contra Neon en vez de Postgres
  // local por Docker, que nunca pasa por `fetch`.
  const sent: Sent[] = [];
  const realFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("api.openai.com")) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: "reply",
                      arguments: JSON.stringify({ message: "(mock de OpenAI) ¡Listo!" }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("graph.facebook.com")) {
      sent.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.FAKE" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return realFetch(input, init);
  }) as typeof fetch;

  const { handleIncoming } = await import("../apps/bot/src/bot/orchestrator");
  const { assertMenuOrder } = await import("../apps/bot/src/bot/order-guard");
  const { redeemOrder } = await import("../apps/bot/src/db/queries/orders");
  const { getConversationByPhone, setBotPaused } = await import(
    "../apps/bot/src/db/queries/conversation"
  );

  const phone = `57302${Date.now()}`.slice(0, 12);
  let waSeq = 0;
  const wamid = () => `wamid.TEST_${Date.now()}_${waSeq++}`;
  const incoming = (over: Record<string, unknown>) => ({
    waMessageId: wamid(),
    phone,
    profileName: null as string | null,
    timestamp: new Date(),
    ...over,
  });

  // Ventana abierta: sin esto, todo se corta en el cliente antes de armar el
  // mensaje, y no se estaría probando la elección de tipo de envío.
  await db.insert(conversations).values({ phone, lastInboundAt: new Date() });

  console.log("── RF-16: el candado ──");
  const [draftOrder] = await db
    .insert(orders)
    .values({
      code: generateOrderCode(),
      status: "draft",
      source: "menu",
      subtotal: 26000,
      deliveryFee: 5000,
      total: 31000,
    })
    .returning();
  ok("un pedido SIN canjear no pasa el candado", !assertMenuOrder(draftOrder));

  const claimed = await redeemOrder(draftOrder.id, phone);
  const [redeemedOrder] = await db.select().from(orders).where(eq(orders.id, draftOrder.id));
  ok("canjear marca redeemedAt", claimed && redeemedOrder.redeemedAt !== null);
  ok("un pedido YA canjeado sí pasa el candado", assertMenuOrder(redeemedOrder));
  ok("RN-01: un código no se canjea dos veces", (await redeemOrder(draftOrder.id, phone)) === false);

  console.log("\n── Saludo: la bienvenida manda CTA con el menú ──");
  process.env.WELCOME_IMAGE_URL = "https://ejemplo.test/bienvenida.jpg";
  await handleIncoming(incoming({ kind: "text", text: "hola" }));
  // UN solo mensaje aunque haya foto: con menú, la imagen viaja como
  // encabezado del mismo `cta_url`, no como un envío aparte.
  ok("mandó exactamente un mensaje, con foto y todo", sent.length === 1);
  ok(
    "la foto va como encabezado DEL MISMO mensaje",
    (sent[0].body.interactive as any)?.header?.type === "image" &&
      (sent[0].body.interactive as any)?.header?.image?.link ===
        "https://ejemplo.test/bienvenida.jpg",
  );
  ok("es interactive/cta_url (el botón del menú)", sent[0].body.interactive === undefined ? false : (sent[0].body.interactive as any).type === "cta_url");
  ok(
    "el texto explica CÓMO se pide, no solo saluda",
    ((sent[0].body.interactive as any)?.body?.text ?? "").includes("menú"),
  );

  // El link del botón tiene que ser una URL ABSOLUTA. Un `MENU_URL` sin
  // `https://` producía `demo-...vercel.app/?t=...`, que WhatsApp recibe como
  // relativa y el botón no abre nada — sin un solo error en los logs, porque
  // para el bot el envío salió bien. Pasó en vivo; de ahí esta comprobación.
  // `http://` se acepta porque en local `MENU_URL` es `http://localhost:3002`;
  // lo que se está probando es que tenga ESQUEMA, no cuál.
  const ctaUrl = (sent[0].body.interactive as any)?.action?.parameters?.url ?? "";
  ok("el link del menú es absoluto (trae esquema http/https)", /^https?:\/\//.test(ctaUrl));
  ok("y apunta al menú, no al propio bot", !ctaUrl.includes("-bot."));

  sent.length = 0;
  await handleIncoming(incoming({ kind: "text", text: "hola de nuevo" }));
  // SIEMPRE la misma bienvenida, sin variantes de "ya te conozco": el cliente
  // que saluda quiere empezar, y lo único que importa en ese turno es que
  // tenga el instructivo y el botón enfrente.
  ok(
    "un segundo saludo repite la MISMA bienvenida con el menú",
    sent[0]?.body.type === "interactive" &&
      (sent[0].body.interactive as any)?.type === "cta_url" &&
      ((sent[0].body.interactive as any)?.body?.text ?? "").includes("Bienvenido a"),
  );

  console.log("\n── Flujo del pedido: código → dirección → pago ──");
  const [order2] = await db
    .insert(orders)
    .values({
      code: generateOrderCode(),
      status: "draft",
      source: "menu",
      subtotal: 8000,
      deliveryFee: 5000,
      total: 13000,
    })
    .returning();
  await db.insert(orderItems).values({
    orderId: order2.id,
    nameSnapshot: "Papas a la Francesa",
    unitPrice: 8000,
    quantity: 1,
    selectedOptions: [],
    lineTotal: 8000,
  });

  sent.length = 0;
  await handleIncoming(incoming({ kind: "text", text: `#PEDIDO ${order2.code}` }));
  let conv = await getConversationByPhone(phone);
  ok("canjear pasa a collecting_address", conv!.phase === "collecting_address");
  ok("el pedido activo es el correcto", conv!.activeOrderId === order2.id);
  ok("manda el resumen como texto (sin botones ni menú)", sent[0]?.body.type === "text");

  await handleIncoming(incoming({ kind: "text", text: "ok" }));
  conv = await getConversationByPhone(phone);
  ok("respuesta que no parece dirección: sigue en collecting_address", conv!.phase === "collecting_address");

  sent.length = 0;
  await handleIncoming(incoming({ kind: "text", text: "Calle 10 # 5-20, apto 301" }));
  conv = await getConversationByPhone(phone);
  ok("dirección válida pasa a awaiting_payment", conv!.phase === "awaiting_payment");
  ok(
    "pregunta el pago con botones (interactive/button)",
    sent[0]?.body.type === "interactive" && (sent[0].body.interactive as any).type === "button",
  );

  sent.length = 0;
  await handleIncoming(incoming({ kind: "button", buttonId: "pay_efectivo", title: "Efectivo" }));
  conv = await getConversationByPhone(phone);
  const [closedOrder] = await db.select().from(orders).where(eq(orders.id, order2.id));
  ok("pago por botón cierra el pedido: status = pending", closedOrder.status === "pending");
  ok("vuelve a advising sin pedido activo", conv!.phase === "advising" && conv!.activeOrderId === null);
  ok("guarda el método de pago", closedOrder.paymentMethod === "efectivo");
  ok("confirma por texto plano", sent[0]?.body.type === "text");

  console.log("\n── Código ya canjeado por otra conversación ──");
  sent.length = 0;
  await handleIncoming(incoming({ kind: "text", text: `#PEDIDO ${redeemedOrder.code}` }));
  conv = await getConversationByPhone(phone);
  ok("no entra a collecting_address con un código repetido", conv!.phase === "advising");

  console.log("\n── RF-19: 'reiniciar' funciona incluso pausado ──");
  await setBotPaused(conv!.id, true, "prueba");
  sent.length = 0;
  await handleIncoming(incoming({ kind: "text", text: "hola de nuevo, hay alguien?" }));
  const pausedStill = await getConversationByPhone(phone);
  ok("RN-04: pausado no manda NADA salvo 'reiniciar'", pausedStill!.botPaused === true && sent.length === 0);

  await handleIncoming(incoming({ kind: "text", text: "reiniciar" }));
  const resumed = await getConversationByPhone(phone);
  ok("'reiniciar' retoma al asistente", resumed!.botPaused === false);

  console.log("\n── RF-14/RF-17: audio e imagen degradan con gracia (sin OpenAI) ──");
  sent.length = 0;
  await handleIncoming(
    incoming({ kind: "audio", mediaId: "media1", mimeType: "audio/ogg" }),
  );
  ok("audio sin transcribir -> mensaje fijo, no revienta", sent[0]?.body.type === "text");

  sent.length = 0;
  await handleIncoming(
    incoming({ kind: "image", mediaId: "media2", mimeType: "image/jpeg", caption: null }),
  );
  ok("imagen -> mensaje fijo, no revienta", sent[0]?.body.type === "text");

  // limpieza
  await db.delete(orders).where(eq(orders.id, draftOrder.id));
  await db.delete(orders).where(eq(orders.id, order2.id));
  await db.delete(conversations).where(eq(conversations.phone, phone));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
