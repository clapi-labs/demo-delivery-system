import { createMenuToken, verifyMenuToken } from "../packages/shared/src/domain/menu-token";
import { isWindowOpen, windowRemaining, formatWindowRemaining } from "../packages/shared/src/domain/session-window";
import { parseOrderCode, generateOrderCode } from "../packages/shared/src/domain/order-code";
import { formatCOP, formatPhone, normalize } from "../packages/shared/src/domain/format";

const ok = (label: string, cond: boolean) => console.log(`${cond ? "✓" : "✗"} ${label}`);
const SECRET = "secreto-de-prueba";

console.log("── Token del menú (identifica el teléfono) ──");
const token = createMenuToken("573001234567", SECRET);
ok("token válido devuelve el teléfono", verifyMenuToken(token, SECRET)?.phone === "573001234567");
ok("token con otro secreto se rechaza", verifyMenuToken(token, "otro-secreto") === null);
ok("token manipulado se rechaza", verifyMenuToken(token.slice(0, -3) + "aaa", SECRET) === null);
ok("token vacío/nulo se rechaza", verifyMenuToken(null, SECRET) === null && verifyMenuToken("", SECRET) === null);
ok("token basura no revienta", verifyMenuToken("no.es-un-token", SECRET) === null);
const expirado = createMenuToken("573001234567", SECRET, -1);
ok("token caducado se rechaza", verifyMenuToken(expirado, SECRET) === null);

console.log("\n── Ventana de 24 h de WhatsApp ──");
const ahora = new Date("2026-09-22T18:00:00Z");
ok("hace 1 h -> abierta", isWindowOpen(new Date("2026-09-22T17:00:00Z"), ahora));
ok("hace 23 h -> abierta", isWindowOpen(new Date("2026-09-21T19:00:00Z"), ahora));
ok("hace 25 h -> CERRADA", !isWindowOpen(new Date("2026-09-21T17:00:00Z"), ahora));
ok("sin mensajes previos -> CERRADA", !isWindowOpen(null, ahora));
ok("margen de seguridad: hace 23h58m -> cerrada", !isWindowOpen(new Date("2026-09-21T18:02:00Z"), ahora));
const r = windowRemaining(new Date("2026-09-22T17:00:00Z"), ahora);
ok(`quedan ~22h (${formatWindowRemaining(r.minutesLeft)})`, r.open && r.minutesLeft > 1300);

console.log("\n── Código del pedido ──");
const code = generateOrderCode();
ok(`genera 6 caracteres sin ambiguos (${code})`, /^[ACDEFGHJKMNPQRSTUVWXYZ234679]{6}$/.test(code));
ok("reconoce '#PEDIDO A7K3M9'", parseOrderCode("hola #PEDIDO A7K3M9") === "A7K3M9");
ok("reconoce sin # y en minúscula", parseOrderCode("pedido a7k3m9") === "A7K3M9");
ok("ignora texto sin código", parseOrderCode("quiero pedir algo") === null);

console.log("\n── Formato ──");
ok("precio COP", formatCOP(18000) === "$18.000");
ok("teléfono legible", formatPhone("573001234567") === "+57 300 123 4567");
ok("normaliza tildes", normalize("Limón") === "limon");
