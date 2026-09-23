/**
 * Verifica que `sendText` corte ANTES de llamar a la red cuando la ventana de
 * 24 h está cerrada (RF-09). No prueba el envío real: eso exige credenciales
 * de Meta y se hace a mano (docs/DEPLOYMENT.md, paso 6).
 *
 * Se envuelve `global.fetch` para comprobar que WhatsApp NUNCA se llama
 * cuando la ventana está cerrada — si el guard fallara, este fetch de prueba
 * lo delataría.
 *
 * **Ojo:** el driver HTTP de Neon (`@neondatabase/serverless`) también usa
 * `fetch` para hablar con la base — así se descubrió, corriendo esto contra
 * Neon en vez de Postgres local por Docker, que nunca pasa por `fetch`. El
 * mock solo cuenta llamadas a `graph.facebook.com`; todo lo demás (incluidas
 * las consultas reales a la base) sigue de largo al `fetch` real, o las
 * consultas del propio script romperían con una respuesta falsa que no tiene
 * la forma que la base espera.
 */
// Sin esto, `checkActive()` (ADR-11) corta antes que la ventana y las
// aserciones de abajo verían "bot_inactive" en vez de "window_closed".
process.env.BOT_ACTIVE = "true";

import { eq } from "drizzle-orm";

import { conversations, db } from "../packages/shared/src/db";

const ok = (label: string, cond: boolean) => console.log(`${cond ? "✓" : "✗"} ${label}`);

async function main() {
  let fetchCalled = false;
  const realFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("graph.facebook.com")) fetchCalled = true;
    return realFetch(input, init);
  }) as typeof fetch;

  const { sendText } = await import("../apps/bot/src/services/whatsapp/client");

  const phone = `57301${Date.now()}`.slice(0, 12);

  console.log("── Ventana cerrada: nunca llama a la red ──");
  const noConversation = await sendText(phone, "no debería salir");
  ok("sin conversación previa -> window_closed", !noConversation.ok && noConversation.reason === "window_closed");
  ok("no llamó a fetch", !fetchCalled);

  const [conv] = await db
    .insert(conversations)
    .values({
      phone,
      lastInboundAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // hace 25 h
    })
    .returning();

  fetchCalled = false;
  const closedResult = await sendText(phone, "tampoco debería salir");
  ok("último mensaje hace 25 h -> window_closed", !closedResult.ok && closedResult.reason === "window_closed");
  ok("no llamó a fetch", !fetchCalled);

  await db.delete(conversations).where(eq(conversations.id, conv.id));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
