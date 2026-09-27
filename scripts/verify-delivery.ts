import { startOfBusinessDay, businessDayRange } from "../packages/shared/src/domain/business-day";
import { createCourierToken, verifyCourierToken } from "../packages/shared/src/domain/courier-token";
import {
  COURIER_PAYMENT_LABEL,
  dispatchTicket,
  courierBrief,
  mapsLink,
  whatsappLink,
  type CourierRef,
  type DeliveryOrder,
} from "../packages/shared/src/domain/delivery";

/**
 * El módulo de domicilios, sin base de datos (RF-49 a RF-54).
 *
 * Lo que se comprueba acá es lo que se rompe en silencio: la ficha que le
 * llega al mensajero. Un texto sin la línea del dinero, o con el "no cobrar"
 * al revés, es un mensajero cobrando dos veces o volviendo con las manos
 * vacías — y eso no lo detecta ningún tipo de TypeScript.
 *
 *   npm run verify:delivery
 */

const ok = (label: string, cond: boolean) => console.log(`${cond ? "✓" : "✗"} ${label}`);
const SECRET = "secreto-de-prueba";

const PEDIDO: DeliveryOrder = {
  code: "K3M9QZ",
  customerName: "Juan Pérez",
  phone: "573001112233",
  address: "Calle 45 #12-30, apto 501",
  addressNotes: "Tocar el timbre del 3",
  total: 83000,
  paymentMethod: "efectivo",
  items: [
    { quantity: 2, name: "Doble Tocineta" },
    { quantity: 1, name: "Papas con Queso" },
  ],
};

const PROPIO: CourierRef = { name: "Carlos Pérez", phone: "573001112244", kind: "internal" };
const AGENCIA: CourierRef = { name: "Bejarano", phone: "573112223300", kind: "agency" };

console.log("── La ficha del mensajero ──");
const propia = dispatchTicket(PEDIDO, PROPIO);
ok("nombra el pedido por su código", propia.includes("K3M9QZ"));
ok("lleva la dirección de entrega", propia.includes("Calle 45 #12-30, apto 501"));
ok("lleva las notas de la dirección", propia.includes("Tocar el timbre del 3"));
ok("lleva el teléfono del cliente legible", propia.includes("+57 300 111 2233"));
ok("lleva los productos", propia.includes("2× Doble Tocineta"));
ok("lleva el enlace del mapa", propia.includes("https://www.google.com/maps/search/"));

console.log("\n── El dinero, que es lo que se cobra mal ──");
ok("efectivo: dice cuánto cobrar", dispatchTicket(PEDIDO, PROPIO).includes("Cobrar al cliente: *$83.000*"));
ok(
  "ya pagó: dice que NO cobre",
  dispatchTicket({ ...PEDIDO, paymentMethod: "transferencia" }, PROPIO).includes("NO cobrar"),
);
ok(
  "a cuenta de la agencia: dice que NO cobre",
  dispatchTicket(PEDIDO, AGENCIA, "account").includes("NO cobrar al cliente"),
);
ok(
  "base en efectivo: sigue diciendo cuánto",
  dispatchTicket(PEDIDO, AGENCIA, "cash_base").includes("$83.000"),
);
ok(
  "pago sin confirmar: avisa que hay que confirmarlo",
  dispatchTicket({ ...PEDIDO, paymentMethod: null }, PROPIO).includes("pago sin confirmar"),
);

console.log("\n── Recogida y enlace del repartidor ──");
ok(
  "a la agencia se le dice dónde recoger",
  dispatchTicket(PEDIDO, AGENCIA, "cash_base", "Cl. 5 #24-10").includes("Recoger en: Cl. 5 #24-10"),
);
ok(
  "sin dirección configurada, la ficha lo grita en vez de callarlo",
  dispatchTicket(PEDIDO, AGENCIA, "cash_base", "").includes("⚠️ falta configurar la dirección"),
);
ok("al propio NO se le dice (ya está en el local)", !propia.includes("Recoger en"));
const brief = courierBrief(PEDIDO, PROPIO, "https://portal.test/repartidor?t=abc");
ok("el aviso al propio lleva su enlace", brief.includes("https://portal.test/repartidor?t=abc"));
ok("sin enlace, el aviso es la ficha tal cual", courierBrief(PEDIDO, PROPIO) === propia);

console.log("\n── El atajo de WhatsApp (así se despacha con una agencia) ──");
const link = whatsappLink("+57 311 222 3300", "Hola, va un domicilio");
ok("usa wa.me con el número sin signos", link.startsWith("https://wa.me/573112223300?text="));
ok("el texto va codificado", link.includes("Hola%2C%20va%20un%20domicilio"));
ok(
  "una ficha entera cabe en el enlace",
  whatsappLink(AGENCIA.phone, dispatchTicket(PEDIDO, AGENCIA, "cash_base")).length < 8000,
);
ok("el mapa escapa la dirección", mapsLink("Calle 45 #12-30").includes("%2312-30"));

console.log("\n── El link del repartidor ──");
const token = createCourierToken(7, SECRET);
ok("token válido devuelve su id", verifyCourierToken(token, SECRET)?.courierId === 7);
ok("con otro secreto se rechaza", verifyCourierToken(token, "otro") === null);
ok("manipulado se rechaza", verifyCourierToken(token.slice(0, -3) + "aaa", SECRET) === null);
ok("vacío o basura no revienta", verifyCourierToken("", SECRET) === null && verifyCourierToken("x.y", SECRET) === null);
ok("caducado se rechaza", verifyCourierToken(createCourierToken(7, SECRET, -1), SECRET) === null);
ok("dura 30 días por defecto", (verifyCourierToken(token, SECRET)!.exp - Math.floor(Date.now() / 1000)) > 29 * 86400);

console.log("\n── El día del negocio (para el cierre de turno) ──");
// 2026-09-27T02:30:00Z son las 9:30 p.m. del 26 en Bogotá: el turno de la
// noche NO puede contar como el día siguiente.
const nocheDeBogota = new Date("2026-09-27T02:30:00Z");
const inicio = startOfBusinessDay(nocheDeBogota, "America/Bogota");
ok("la medianoche de Bogotá es 05:00 UTC", inicio.toISOString() === "2026-09-26T05:00:00.000Z");
ok("las 9:30 p.m. cuentan para el mismo día", inicio < nocheDeBogota);
const rango = businessDayRange(nocheDeBogota, "America/Bogota");
ok("el rango dura 24 h", rango.until.getTime() - rango.since.getTime() === 24 * 3600_000);
ok("y contiene ese momento", rango.since <= nocheDeBogota && nocheDeBogota < rango.until);

console.log("\n── Etiquetas ──");
ok("modalidades con nombre propio", COURIER_PAYMENT_LABEL.cash_base.length > 0 && COURIER_PAYMENT_LABEL.account.length > 0);
