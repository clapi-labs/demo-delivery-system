/**
 * Datos de demostración del portal.
 *
 * - **Pedidos:** solo se usan con `NEXT_PUBLIC_PORTAL_DEMO="true"`. Sin esa
 *   variable, los pedidos salen de Neon de verdad (`GET /api/orders`).
 * - **Conversaciones y menú:** hoy son la única fuente — el frontend está
 *   listo y la conexión se hace en `src/lib/portal-api.ts`.
 *
 * El menú NO es inventado aquí: sale del mismo catálogo semilla que carga
 * `npm run db:seed`, para que el portal muestre exactamente los productos que
 * ve el cliente en el menú público.
 *
 * Todas las fechas son relativas al momento de cargar la página, redondeado al
 * minuto, para que servidor y navegador generen los mismos datos.
 */

import { CATALOG } from "@sistema/shared/db/seed-data";

import type { InboxConversation, InboxMessage } from "./inbox";
import type { MenuCategory, MenuProduct, MenuSymbolName, Promotion } from "./menu";
import type { OrderStatus, PortalOrder } from "./orders";

const NOW = Math.floor(Date.now() / 60_000) * 60_000;
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

// --- Pedidos -----------------------------------------------------------------

type Line = [name: string, quantity: number, unitPrice: number, options?: string[]];

function order(
  id: number,
  code: string,
  status: OrderStatus,
  minutesAgo: number,
  customerName: string,
  phone: string,
  address: string | null,
  paymentMethod: PortalOrder["paymentMethod"],
  lines: Line[],
): PortalOrder {
  const items = lines.map(([name, quantity, unitPrice, options = []]) => ({
    name,
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    options: options.map((o) => ({ group: "", name: o, priceDelta: 0 })),
  }));
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  return {
    id,
    code,
    status,
    phone,
    customerName,
    address,
    paymentMethod,
    subtotal,
    deliveryFee: 5000,
    total: subtotal + 5000,
    createdAt: ago(minutesAgo),
    items,
  };
}

export function demoOrders(): PortalOrder[] {
  return [
    order(14, "K3M9QZ", "pending", 2, "Juan Pérez", "573001112233", "Calle 45 #12-30, apto 501", "transferencia", [
      ["Doble Tocineta", 2, 26000, ["Tres cuartos", "Queso adicional"]],
      ["Papas con Queso y Tocineta", 1, 13000],
      ["Gaseosa 400 ml", 2, 4000, ["Cola"]],
    ]),
    order(13, "HT7RWA", "pending", 7, "Diego Salazar", "573007778899", "Calle 63 #7-18", "efectivo", [
      ["Alitas x12", 1, 39500, ["BBQ", "Maracuyá picante"]],
      ["Limonada Natural", 1, 14000, ["Jarra"]],
    ]),
    order(12, "P4NXJC", "pending", 12, "Camila Torres", "573008889900", "Carrera 30 #10-55, casa 4", "datafono", [
      ["Hamburguesa Vegetariana", 1, 17000, ["Papas rústicas"]],
      ["Malteada", 1, 12000, ["Fresa"]],
    ]),
    order(11, "M2QYTE", "preparing", 16, "Andrea Gómez", "573004445566", "Transversal 21 #45-12", "efectivo", [
      ["Costilla BBQ", 2, 24000, ["Bien asada"]],
      ["Aros de Cebolla", 1, 10000],
    ]),
    order(10, "W9HKDR", "preparing", 24, "Santiago Vargas", "573009990011", "Calle 19 #4-22", "transferencia", [
      ["Pollo Broaster (1/4)", 3, 16000],
      ["Yuca Frita", 2, 9000],
      ["Gaseosa 400 ml", 3, 4000, ["Naranja"]],
    ]),
    order(9, "R6CJTN", "sent", 31, "María López", "573002223344", "Carrera 9 #67-21, torre 2", "datafono", [
      ["Hamburguesa Clásica", 1, 18000, ["Término medio"]],
      ["Brownie con Helado", 1, 12000],
    ]),
    order(8, "Z3FWQK", "sent", 38, "Laura Ramírez", "573006667788", "Carrera 15 #88-40", "transferencia", [
      ["Wrap de Pollo Crispy", 2, 17000],
      ["Limonada de Coco", 2, 9000],
    ]),
    order(7, "T7GMHX", "delivered", 64, "Carlos Ruiz", "573003334455", "Calle 80 #14-06", "efectivo", [
      ["Alitas x6", 1, 22000, ["Búfalo"]],
      ["Papas a la Francesa", 1, 8000],
    ]),
    order(6, "N4DKQA", "delivered", 95, "Felipe Ortiz", "573005556677", "Calle 127 #52-10", "transferencia", [
      ["Doble Tocineta", 1, 26000],
      ["Gaseosa 400 ml", 1, 4000, ["Cola sin azúcar"]],
    ]),
    order(5, "J9WRTC", "delivered", 130, "Valentina Reyes", "573001110022", "Carrera 50 #26-70", "datafono", [
      ["Hamburguesa de Pollo", 2, 19000],
      ["Deditos de Pollo", 1, 15000],
    ]),
    order(4, "E2HQMP", "cancelled", 150, "Sebastián Mora", "573112223344", "Calle 34 #20-11", "efectivo", [
      ["Hamburguesa Clásica", 1, 18000],
    ]),
    order(3, "C7KTWN", "delivered", 185, "Daniela Castro", "573123334455", "Avenida 68 #45-90", "transferencia", [
      ["Alitas x12", 1, 38000, ["Miel mostaza"]],
      ["Cheesecake de Maracuyá", 2, 13000],
    ]),
    order(2, "G3PXRH", "delivered", 240, "Andrés Herrera", "573134445566", "Calle 100 #19-30", "efectivo", [
      ["Costilla BBQ", 1, 24000],
      ["Jugo Natural en Agua", 1, 7000],
    ]),
    order(1, "A6MJQT", "delivered", 290, "Natalia Rincón", "573145556677", "Carrera 7 #72-15", "datafono", [
      ["Hamburguesa Clásica", 2, 18000],
      ["Papas a la Francesa", 2, 8000],
    ]),
  ];
}

/** El pedido que "entra solo" en modo demo, para ver el aviso en vivo. */
export function demoIncomingOrder(): PortalOrder {
  const fresh = order(15, "Q7RMWT", "pending", 0, "Isabela Duarte", "573156667788", "Calle 72 #11-40, apto 302", "transferencia", [
    ["Hamburguesa Clásica", 2, 18000, ["Tres cuartos"]],
    ["Aros de Cebolla", 1, 10000],
  ]);
  return { ...fresh, createdAt: new Date().toISOString() };
}

// --- Conversaciones ----------------------------------------------------------

let msgSeq = 0;
function msg(
  role: InboxMessage["role"],
  minutesAgo: number,
  text: string,
  meta?: InboxMessage["meta"],
  kind: InboxMessage["kind"] = "text",
): InboxMessage {
  msgSeq += 1;
  return { id: `demo-${msgSeq}`, role, kind, text, createdAt: ago(minutesAgo), meta };
}

function convo(
  c: Omit<InboxConversation, "lastMessageAt" | "lastInboundAt"> & { windowMinutesAgo?: number },
): InboxConversation {
  const last = c.messages[c.messages.length - 1];
  const lastCustomer = [...c.messages].reverse().find((m) => m.role === "customer");
  const { windowMinutesAgo, ...rest } = c;
  return {
    ...rest,
    lastMessageAt: last?.createdAt ?? ago(0),
    lastInboundAt:
      windowMinutesAgo !== undefined ? ago(windowMinutesAgo) : (lastCustomer?.createdAt ?? null),
  };
}

export function demoConversations(): InboxConversation[] {
  // Mismos ids en cada llamada (servidor y navegador generan lo mismo).
  msgSeq = 0;
  return [
    convo({
      id: 5,
      phone: "573005556677",
      displayName: "Felipe Ortiz",
      botPaused: true,
      escalationReason: "Pidió hablar con una persona: su pedido llegó incompleto.",
      phase: "advising",
      unread: 2,
      messages: [
        msg("customer", 9, "Buenas, acabo de recibir el pedido N4DKQA"),
        msg("customer", 9, "Me llegó la hamburguesa pero faltó la gaseosa"),
        msg(
          "bot",
          9,
          "Qué pena contigo Eso no te lo quiero responder a medias: ya le avisé a una persona del equipo para que te ayude.",
        ),
        msg("customer", 4, "Ok, quedo atento"),
      ],
    }),
    convo({
      id: 1,
      phone: "573001112233",
      displayName: "Juan Pérez",
      botPaused: false,
      escalationReason: null,
      phase: "awaiting_payment",
      unread: 0,
      messages: [
        msg("customer", 8, "Hola, buenas tardes"),
        msg("bot", 8, "¡Hola Juan! Bienvenido a Sabor Urbano. Arma tu pedido desde el menú:", { cta: "Ver el menú" }),
        msg("customer", 3, "#PEDIDO K3M9QZ"),
        msg(
          "bot",
          3,
          "¡Recibí tu pedido K3M9QZ! 2× Doble Tocineta, 1× Papas con Queso y Tocineta, 2× Gaseosa. Total $83.000. ¿Cómo vas a pagar?",
          { buttons: ["Efectivo", "Transferencia", "Datáfono"] },
        ),
        msg("customer", 2, "Transferencia", undefined, "button"),
        msg("bot", 2, "Listo. Envía el comprobante a Nequi 300 123 4567 y te confirmo apenas llegue."),
      ],
    }),
    convo({
      id: 2,
      phone: "573002223344",
      displayName: "María López",
      botPaused: false,
      escalationReason: null,
      phase: "advising",
      unread: 0,
      messages: [
        msg("customer", 34, "¿Cuánto vale la hamburguesa clásica?"),
        msg("bot", 34, "La Hamburguesa Clásica vale $18.000 e incluye papas a la francesa", { cta: "Ver el menú" }),
        msg("customer", 33, "Perfecto, ya la pido"),
        msg("customer", 6, "¿Ya va en camino?"),
        msg("bot", 6, "¡Sí! Tu pedido R6CJTN salió hace unos minutos"),
      ],
    }),
    convo({
      id: 7,
      phone: "573007778899",
      displayName: "Diego Salazar",
      botPaused: false,
      escalationReason: null,
      phase: "collecting_address",
      unread: 0,
      messages: [
        msg("customer", 12, "Hola"),
        msg("bot", 12, "¡Hola Diego! Aquí tienes el menú para armar tu pedido:", { cta: "Ver el menú" }),
        msg("customer", 7, "#PEDIDO HT7RWA"),
        msg("bot", 7, "¡Recibí tu pedido HT7RWA! ¿Lo enviamos a Calle 63 #7-18?", { buttons: ["Sí, ahí", "Otra dirección"] }),
        msg("customer", 7, "Sí, ahí", undefined, "button"),
      ],
    }),
    convo({
      id: 6,
      phone: "573006667788",
      displayName: "Laura Ramírez",
      botPaused: true,
      escalationReason: null,
      phase: "advising",
      unread: 0,
      messages: [
        msg("customer", 50, "¿Tienen algo sin carne?"),
        msg("bot", 50, "Sí, la Hamburguesa Vegetariana: torta de garbanzo y quinua con aguacate, $17.000"),
        msg("customer", 45, "¿Y la pueden hacer sin cebolla? Soy alérgica"),
        msg("agent", 44, "Hola Laura, te habla Carolina de Sabor Urbano. Claro que sí, la dejamos sin cebolla y separamos la plancha"),
        msg("customer", 42, "Mil gracias!!"),
      ],
    }),
    convo({
      id: 3,
      phone: "573003334455",
      displayName: "Carlos Ruiz",
      botPaused: false,
      escalationReason: null,
      phase: "advising",
      unread: 0,
      messages: [
        msg("customer", 72, "Quiero hacer un pedido"),
        msg("bot", 72, "¡Con gusto! Ábrelo desde el menú y cuando lo envíes te confirmo por acá.", { cta: "Ver el menú" }),
        msg("customer", 58, "Muy rico todo, gracias"),
        msg("bot", 58, "¡Gracias a ti, Carlos! Que lo disfrutes."),
      ],
    }),
    convo({
      id: 8,
      phone: "573178889900",
      displayName: "Ricardo Peña",
      botPaused: false,
      escalationReason: null,
      phase: "advising",
      unread: 0,
      windowMinutesAgo: 60 * 26,
      messages: [
        msg("customer", 60 * 26, "¿Hacen domicilios a Chía?"),
        msg("bot", 60 * 26, "Por ahora cubrimos un radio de 4 km alrededor del local. Chía queda fuera de esa zona"),
      ],
    }),
  ];
}

export const DEMO_BOT_STATS = {
  messagesToday: 148,
  ordersGenerated: 21,
};

// --- Menú --------------------------------------------------------------------

/** Símbolo de cada categoría del catálogo semilla. */
const CATEGORY_SYMBOL: Record<string, MenuSymbolName> = {
  hamburguesas: "burger",
  pollo: "chicken",
  acompanamientos: "fries",
  bebidas: "drink",
  postres: "dessert",
};

export function demoMenu(): { categories: MenuCategory[]; products: MenuProduct[] } {
  let productId = 0;
  let groupId = 0;
  let optionId = 0;

  const categories: MenuCategory[] = CATALOG.map((c, i) => ({
    id: i + 1,
    name: c.name,
    symbol: CATEGORY_SYMBOL[c.slug] ?? "plate",
    active: true,
  }));

  const products: MenuProduct[] = CATALOG.flatMap((c, i) =>
    c.products.map((p) => ({
      id: ++productId,
      categoryId: i + 1,
      name: p.name,
      description: p.description,
      price: p.price,
      imageUrl: null,
      available: p.available ?? true,
      optionGroups: (p.optionGroups ?? []).map((g) => ({
        id: ++groupId,
        name: g.name,
        type: g.type,
        required: g.required ?? false,
        options: g.options.map((o) => ({ id: ++optionId, name: o.name, priceDelta: o.priceDelta ?? 0 })),
      })),
    })),
  );

  return { categories, products };
}

export function demoPromotions(): Promotion[] {
  return [
    {
      id: 1,
      name: "Hora feliz de hamburguesas",
      kind: "percent",
      value: 20,
      scope: { type: "category", ids: [1] },
      days: [1, 2, 3, 4, 5],
      from: "15:00",
      to: "18:00",
      active: true,
    },
    {
      id: 2,
      name: "Martes de alitas",
      kind: "2x1",
      value: 0,
      scope: { type: "products", ids: [6] },
      days: [2],
      from: null,
      to: null,
      active: true,
    },
    {
      id: 3,
      name: "Limonada a $5.000",
      kind: "price",
      value: 5000,
      scope: { type: "products", ids: [17] },
      days: [0, 6],
      from: null,
      to: null,
      active: false,
    },
  ];
}
