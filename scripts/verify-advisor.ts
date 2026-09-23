/**
 * Verifica el asesor contra la API real de OpenAI (ya hay `OPENAI_API_KEY`) y
 * contra el catálogo real de Postgres. A diferencia de los scripts
 * anteriores, este SÍ gasta unas pocas llamadas reales — es exactamente lo
 * que hace falta para confiar en el camino de éxito, no solo en la
 * degradación.
 *
 * La aserción más importante no es "contestó algo": es que el PRECIO que
 * aparece en la respuesta es el de la base, no uno que el modelo se haya
 * inventado (ADR-08/ADR-09).
 */
import { formatCOP } from "../packages/shared/src/domain/format";
import { verifyMenuToken } from "../packages/shared/src/domain/menu-token";
import { getCatalog } from "../packages/shared/src/db/queries/catalog";
import { findBySku } from "../packages/shared/src/domain/catalog";

const ok = (label: string, cond: boolean) => console.log(`${cond ? "✓" : "✗"} ${label}`);

async function main() {
  const { isLlmConfigured, askLlm } = await import("../apps/bot/src/services/openai/chat");
  const { runAdvisor } = await import("../apps/bot/src/bot/advisor");

  console.log("── Configuración ──");
  ok("OPENAI_API_KEY presente -> isLlmConfigured() true", isLlmConfigured());

  const catalog = await getCatalog();
  const burger = findBySku(catalog, "BURGER-DOBLE")!;
  const phone = "573001234567";

  console.log(`\n── Llamada real: "¿cuánto vale la ${burger.name.toLowerCase()}?" ──`);
  const reply1 = await runAdvisor(phone, catalog, [
    { role: "user", content: `hola, ¿cuánto vale la ${burger.name.toLowerCase()}?` },
  ]);
  console.log(`  respuesta: ${reply1.text.replace(/\n/g, " / ")}`);
  ok(
    `el precio real (${formatCOP(burger.price)}) aparece en la respuesta`,
    reply1.text.includes(formatCOP(burger.price)),
  );
  ok("no inventó un precio distinto (heurística: solo un '$' en el texto)", (reply1.text.match(/\$/g) ?? []).length <= 1);
  ok("trae el link del menú con un token verificable", verifyMenuToken(new URL(reply1.menu?.url ?? "http://x/?t=").searchParams.get("t"), process.env.MENU_TOKEN_SECRET!)?.phone === phone);

  console.log("\n── Llamada real: pregunta por algo que NO existe ──");
  const reply2 = await runAdvisor(phone, catalog, [
    { role: "user", content: "¿tienen sushi?" },
  ]);
  console.log(`  respuesta: ${reply2.text.replace(/\n/g, " / ")}`);
  ok("dice que no manejamos sushi (lo decide el catálogo, no el modelo)", /no manejamos/i.test(reply2.text));

  console.log("\n── Llamada real: producto agotado ──");
  const reply3 = await runAdvisor(phone, catalog, [
    { role: "user", content: "¿tienen cerveza?" },
  ]);
  console.log(`  respuesta: ${reply3.text.replace(/\n/g, " / ")}`);
  ok("dice agotado, sin ofrecer sustitutos", /agotad/i.test(reply3.text));

  console.log("\n── Llamada real: pedir a una persona ──");
  const reply4 = await runAdvisor(phone, catalog, [
    { role: "user", content: "necesito hablar con una persona, tengo un problema con mi pedido" },
  ]);
  console.log(`  respuesta: ${reply4.text.replace(/\n/g, " / ")}`);
  ok("escala a una persona", reply4.escalated !== undefined);

  console.log("\n── Llamada real: charla simple, sin productos ──");
  const reply5 = await runAdvisor(phone, catalog, [
    { role: "user", content: "gracias, hasta luego" },
  ]);
  console.log(`  respuesta: ${reply5.text.replace(/\n/g, " / ")}`);
  ok("responde sin escalar ni ofrecer el menú a la fuerza", !reply5.escalated);

  console.log("\n── Degradación: la llamada base sigue devolviendo null si algo falla ──");
  const brokenResult = await askLlm("system", [{ role: "user", content: "hola" }], []).catch(() => "threw");
  ok("una llamada normal con tools vacías no lanza (puede devolver texto o null)", brokenResult !== "threw");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
