/**
 * Verifica la Fase 2 contra la base real: normalización del payload de Meta,
 * idempotencia, y el registro de conversación. No hace llamadas de red a
 * Meta — eso requiere credenciales reales y se prueba a mano en el paso 6 de
 * docs/DEPLOYMENT.md.
 */
import { db, conversations, processedMessages } from "../packages/shared/src/db";
import { eq } from "drizzle-orm";

const ok = (label: string, cond: boolean) => console.log(`${cond ? "✓" : "✗"} ${label}`);

// Importa directo desde apps/bot: son módulos TS, tsx los resuelve igual.
async function main() {
  const { extractIncomingMessages } = await import(
    "../apps/bot/src/services/whatsapp/normalize"
  );
  const {
    upsertConversationOnInbound,
    recordMessage,
    getConversationByPhone,
  } = await import("../apps/bot/src/db/queries/conversation");
  const { markProcessedIfNew } = await import(
    "../apps/bot/src/db/queries/idempotency"
  );

  console.log("── Normalización del payload de Meta (RF-07) ──");

  const textPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [{ wa_id: "573001112233", profile: { name: "Ana" } }],
              messages: [
                {
                  id: "wamid.TEXTO1",
                  from: "573001112233",
                  timestamp: "1700000000",
                  type: "text",
                  text: { body: "Hola, quiero pedir" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const [text] = extractIncomingMessages(textPayload as any);
  ok("reconoce mensaje de texto", text?.kind === "text" && text.text === "Hola, quiero pedir");
  ok("trae el teléfono", text?.phone === "573001112233");
  ok("trae el nombre del perfil", text?.profileName === "Ana");

  const statusPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              statuses: [
                { id: "wamid.ACUSE1", status: "delivered", recipient_id: "573001112233" },
              ],
            },
          },
        ],
      },
    ],
  };
  ok(
    "descarta 'statuses' — no son mensajes (RF-07)",
    extractIncomingMessages(statusPayload as any).length === 0,
  );

  const audioPayload = {
    object: "whatsapp_business_account",
    entry: [{ id: "1", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      messages: [{ id: "wamid.AUDIO1", from: "573009998877", timestamp: "1700000001",
        type: "audio", audio: { id: "media123", mime_type: "audio/ogg" } }],
    } }] }],
  };
  const [audio] = extractIncomingMessages(audioPayload as any);
  ok("reconoce nota de voz", audio?.kind === "audio" && (audio as any).mediaId === "media123");

  const buttonPayload = {
    object: "whatsapp_business_account",
    entry: [{ id: "1", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      messages: [{ id: "wamid.BTN1", from: "573001112233", timestamp: "1700000002",
        type: "interactive",
        interactive: { type: "button_reply", button_reply: { id: "pay_cash", title: "Efectivo" } } }],
    } }] }],
  };
  const [button] = extractIncomingMessages(buttonPayload as any);
  ok("reconoce botón", button?.kind === "button" && (button as any).buttonId === "pay_cash");

  const stickerPayload = {
    object: "whatsapp_business_account",
    entry: [{ id: "1", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      messages: [{ id: "wamid.STK1", from: "573001112233", timestamp: "1700000003", type: "sticker" }],
    } }] }],
  };
  const [sticker] = extractIncomingMessages(stickerPayload as any);
  ok("tipo no soportado no revienta", sticker?.kind === "unsupported" && (sticker as any).type === "sticker");

  console.log("\n── Idempotencia (RF-06) ──");
  const testId = `wamid.TEST_${Date.now()}`;
  const first = await markProcessedIfNew(testId);
  const second = await markProcessedIfNew(testId);
  ok("primera vez -> true (hay que procesarlo)", first === true);
  ok("segunda vez (reintento de Meta) -> false", second === false);

  console.log("\n── Conversación al llegar un mensaje ──");
  const phone = `57300${Date.now()}`.slice(0, 12);
  const conv1 = await upsertConversationOnInbound(phone, "Cliente de Prueba");
  ok("crea la conversación con lastInboundAt", conv1.lastInboundAt !== null);
  ok("guarda el nombre del perfil", conv1.displayName === "Cliente de Prueba");

  const before = conv1.lastInboundAt!.getTime();
  await new Promise((r) => setTimeout(r, 50));
  const conv2 = await upsertConversationOnInbound(phone, null);
  ok("2do mensaje: mismo id, no duplica conversación", conv2.id === conv1.id);
  ok("2do mensaje: actualiza lastInboundAt", conv2.lastInboundAt!.getTime() > before);
  ok("sin nombre nuevo, conserva el anterior", conv2.displayName === "Cliente de Prueba");

  await recordMessage(conv1.id, "customer", "text", "hola", { waMessageId: "wamid.X1" });
  const found = await getConversationByPhone(phone);
  ok("lastMessageAt se actualiza al guardar un mensaje", found!.lastMessageAt > found!.createdAt);

  // limpieza
  await db.delete(conversations).where(eq(conversations.phone, phone));
  await db.delete(processedMessages).where(eq(processedMessages.waMessageId, testId));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
