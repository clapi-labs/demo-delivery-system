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
import { getPromotions } from "../packages/shared/src/db/queries/promotions";
import { businessDay, promotionsOnDay } from "../packages/shared/src/domain/promotions";
import { findBySku } from "../packages/shared/src/domain/catalog";

const ok = (label: string, cond: boolean) => console.log(`${cond ? "✓" : "✗"} ${label}`);

async function main() {
  const { isLlmConfigured, askLlm } = await import("../apps/bot/src/services/openai/chat");
  const { runAdvisor } = await import("../apps/bot/src/bot/advisor");

  console.log("── Configuración ──");
  ok("OPENAI_API_KEY presente -> isLlmConfigured() true", isLlmConfigured());

  const catalog = await getCatalog();
  const promos = await getPromotions();
  const burger = findBySku(catalog, "BURGER-DOBLE")!;
  const phone = "573001234567";

  console.log(`\n── Llamada real: "¿cuánto vale la ${burger.name.toLowerCase()}?" ──`);
  const reply1 = await runAdvisor(phone, catalog, promos, [
    { role: "user", content: `hola, ¿cuánto vale la ${burger.name.toLowerCase()}?` },
  ]);
  console.log(`  respuesta: ${reply1.text.replace(/\n/g, " / ")}`);
  ok(
    `el precio real (${formatCOP(burger.price)}) aparece en la respuesta`,
    reply1.text.includes(formatCOP(burger.price)),
  );
  // Antes esto exigía un solo "$" en el texto. Dejó de servir cuando el
  // asesor pasó a mostrar el total de una cantidad ("2× ... $19.000
  // ($38.000)"): lo que importa no es cuántos precios salen, sino que TODOS
  // salgan del catálogo. Se comprueba que cada uno sea el precio real o un
  // múltiplo suyo.
  const montos = [...reply1.text.matchAll(/\$([\d.]+)/g)].map((m) => Number(m[1].replace(/\./g, "")));
  ok(
    `no inventó un precio: ${montos.map((n) => "$" + n.toLocaleString("es-CO")).join(", ") || "ninguno"} sale(n) de ${formatCOP(burger.price)}`,
    montos.length > 0 && montos.every((n) => n % burger.price === 0),
  );
  ok("trae el link del menú con un token verificable", verifyMenuToken(new URL(reply1.menu?.url ?? "http://x/?t=").searchParams.get("t"), process.env.MENU_TOKEN_SECRET!)?.phone === phone);

  console.log("\n── Llamada real: pregunta por algo que NO existe ──");
  const reply2 = await runAdvisor(phone, catalog, promos, [
    { role: "user", content: "¿tienen sushi?" },
  ]);
  console.log(`  respuesta: ${reply2.text.replace(/\n/g, " / ")}`);
  ok("dice que no manejamos sushi (lo decide el catálogo, no el modelo)", /no manejamos/i.test(reply2.text));

  console.log("\n── Llamada real: producto agotado ──");
  const reply3 = await runAdvisor(phone, catalog, promos, [
    { role: "user", content: "¿tienen cerveza?" },
  ]);
  console.log(`  respuesta: ${reply3.text.replace(/\n/g, " / ")}`);
  ok("dice agotado, sin ofrecer sustitutos", /agotad/i.test(reply3.text));

  console.log("\n── Llamada real: pedir a una persona ──");
  const reply4 = await runAdvisor(phone, catalog, promos, [
    { role: "user", content: "necesito hablar con una persona, tengo un problema con mi pedido" },
  ]);
  console.log(`  respuesta: ${reply4.text.replace(/\n/g, " / ")}`);
  ok("escala a una persona", reply4.escalated !== undefined);

  console.log("\n── Llamada real: charla simple, sin productos ──");
  const reply5 = await runAdvisor(phone, catalog, promos, [
    { role: "user", content: "gracias, hasta luego" },
  ]);
  console.log(`  respuesta: ${reply5.text.replace(/\n/g, " / ")}`);
  ok("responde sin escalar ni ofrecer el menú a la fuerza", !reply5.escalated);

  console.log("\n── Llamada real: promoción de hoy ──");
  const reply6 = await runAdvisor(phone, catalog, promos, [
    { role: "user", content: "hola, ¿qué promoción tienes hoy?" },
  ]);
  console.log(`  respuesta: ${reply6.text.replace(/\n/g, " / ")}`);
  const today = promotionsOnDay(promos, businessDay());
  ok(
    today.length > 0
      ? `nombra una promo real de hoy (hay ${today.length})`
      : "dice que hoy no hay promoción",
    today.length > 0
      ? today.some((p) => reply6.text.includes(p.name) || reply6.text.toLowerCase().includes(p.name.toLowerCase().split(" ")[0]))
      : /no tenemos promoci/i.test(reply6.text),
  );
  ok("no se inventa una promo que no existe", !/\b(50|70|80)\s?%/.test(reply6.text));

  console.log("\n── Llamada real: recomendación por ingrediente ──");
  const reply7 = await runAdvisor(phone, catalog, promos, [
    { role: "user", content: "¿tienes una hamburguesa que no tenga queso?" },
  ]);
  console.log(`  respuesta: ${reply7.text.replace(/\n/g, " / ")}`);
  const cheesy = catalog
    .flatMap((c) => c.products)
    .filter((p) => /queso/i.test(p.description))
    .map((p) => p.name);
  ok(
    `no recomienda ninguna que lleve queso (${cheesy.length} la llevan)`,
    !cheesy.some((name) => reply7.text.includes(name)),
  );

  console.log("\n── Degradación: la llamada base sigue devolviendo null si algo falla ──");
  const brokenResult = await askLlm("system", [{ role: "user", content: "hola" }], []).catch(() => "threw");
  ok("una llamada normal con tools vacías no lanza (puede devolver texto o null)", brokenResult !== "threw");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
