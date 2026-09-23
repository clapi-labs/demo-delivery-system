/**
 * Verifica el candado de ADR-11: con el número de WhatsApp compartido con
 * Qanelo por rotación manual, `BOT_ACTIVE` tiene que cortar CUALQUIER envío
 * antes de que se intente — incluso antes de la ventana de 24 h — para que
 * un proceso que sigue corriendo fuera de turno no le escriba al cliente por
 * el número equivocado.
 *
 * Se prueban los tres métodos de envío porque los tres llaman a `post()` por
 * separado; que uno esté bien no dice nada de los otros dos.
 *
 * Credenciales de Meta FALSAS, solo para este proceso. `fetch` se reemplaza
 * por un doble: `graph.facebook.com` SIEMPRE se responde con un mensaje
 * falso (nunca se llama a Meta de verdad, ni siquiera en el caso "activo");
 * todo lo demás —las consultas de Neon— pasa al `fetch` real.
 */
process.env.WHATSAPP_PHONE_NUMBER_ID = "TEST_PHONE_ID";
process.env.WHATSAPP_ACCESS_TOKEN = "TEST_TOKEN";
process.env.WHATSAPP_APP_SECRET = "TEST_SECRET";
process.env.WHATSAPP_VERIFY_TOKEN = "TEST_VERIFY";

import { eq } from "drizzle-orm";

import { conversations, db } from "../packages/shared/src/db";

const ok = (label: string, cond: boolean) => console.log(`${cond ? "✓" : "✗"} ${label}`);

async function main() {
  let fetchCalled = false;
  const realFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("graph.facebook.com")) {
      fetchCalled = true;
      return new Response(JSON.stringify({ messages: [{ id: "wamid.FAKE" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;

  const { sendText, sendButtons, sendCta } = await import(
    "../apps/bot/src/services/whatsapp/client"
  );

  const phone = `57309${Date.now()}`.slice(0, 12);
  // Ventana abierta a propósito: si el candado de ADR-11 no cortara antes,
  // esto le daría oportunidad de intentar el envío de verdad.
  const [conv] = await db
    .insert(conversations)
    .values({ phone, lastInboundAt: new Date() })
    .returning();

  console.log("── BOT_ACTIVE sin poner (o 'false'): nada sale ──");
  delete process.env.BOT_ACTIVE;
  fetchCalled = false;
  const r1 = await sendText(phone, "no debería salir");
  ok("sendText -> bot_inactive", !r1.ok && r1.reason === "bot_inactive");
  ok("no llamó a fetch", !fetchCalled);

  process.env.BOT_ACTIVE = "false";
  fetchCalled = false;
  const r2 = await sendButtons(phone, "no debería salir", [{ id: "x", title: "X" }]);
  ok("sendButtons -> bot_inactive", !r2.ok && r2.reason === "bot_inactive");
  ok("no llamó a fetch", !fetchCalled);

  fetchCalled = false;
  const r3 = await sendCta(phone, "no debería salir", "https://x", "Ver");
  ok("sendCta -> bot_inactive", !r3.ok && r3.reason === "bot_inactive");
  ok("no llamó a fetch", !fetchCalled);

  console.log("\n── BOT_ACTIVE=true: el candado se abre, sigue a la ventana y al envío ──");
  process.env.BOT_ACTIVE = "true";
  fetchCalled = false;
  const r4 = await sendText(phone, "esta sí debería salir");
  ok("ya no corta en bot_inactive", r4.reason !== "bot_inactive");
  ok("llegó a llamar a la Graph API (mockeada)", fetchCalled && r4.ok);

  await db.delete(conversations).where(eq(conversations.id, conv.id));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
