/**
 * Datos de demostración del portal.
 *
 * Fase 5 arranca como frontend puro: esta es la única fuente de datos. Los
 * tipos siguen de cerca el esquema real (`packages/shared/src/db/schema.ts`)
 * a propósito — el día que se conecte a Neon, el cambio es reemplazar estas
 * constantes por las consultas reales, no rediseñar las pantallas.
 */

/** Los mismos valores que `OrderStatus` en el esquema compartido —
 *  `cancelled` incluido, porque un pedido cancelado existe en la base y el
 *  tablero tiene que poder pintarlo sin reventar. */
export type OrderStatus = "pending" | "preparing" | "sent" | "delivered" | "cancelled";

/** El camino normal. `cancelled` queda fuera a propósito: es una salida, no
 *  un paso — no se "avanza" hacia ella desde el botón grande. */
export const ORDER_STATUS_FLOW: OrderStatus[] = ["pending", "preparing", "sent", "delivered"];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Nuevo",
  preparing: "En preparación",
  sent: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_ACTION_LABEL: Record<OrderStatus, string> = {
  pending: "Marcar en preparación",
  preparing: "Marcar como enviado",
  sent: "Marcar como entregado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_STATUS_FLOW.indexOf(status);
  return i >= 0 && i < ORDER_STATUS_FLOW.length - 1 ? ORDER_STATUS_FLOW[i + 1] : null;
}

export type PaymentMethod = "efectivo" | "transferencia" | "datafono";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  datafono: "Datáfono",
};

/** El pago se confirma por chat DESPUÉS de que entra el pedido, así que un
 *  pedido recién llegado legítimamente no tiene método todavía. */
export function paymentLabel(method: string | null | undefined) {
  if (!method) return "Sin confirmar";
  return PAYMENT_METHOD_LABEL[method as PaymentMethod] ?? method;
}

/** "Hace 3 min" a partir de una fecha real de la base. */
export function minutesSince(date: string | Date) {
  const then = typeof date === "string" ? new Date(date) : date;
  return Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
}

export type OrderItem = { name: string; quantity: number; unitPrice: number };

export type DemoOrder = {
  id: number;
  code: string;
  customerName: string;
  phone: string;
  address: string;
  items: OrderItem[];
  deliveryFee: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  minutesAgo: number;
};

function subtotalOf(items: OrderItem[]) {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

export function orderSubtotal(order: DemoOrder) {
  return subtotalOf(order.items);
}

export function orderTotal(order: DemoOrder) {
  return orderSubtotal(order) + order.deliveryFee;
}

export function relativeTime(minutesAgo: number) {
  if (minutesAgo < 1) return "Justo ahora";
  if (minutesAgo < 60) return `Hace ${minutesAgo} min`;
  const hours = Math.round(minutesAgo / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.round(hours / 24)} d`;
}

const RAW_ORDERS: Omit<DemoOrder, "id">[] = [
  {
    code: "#1042",
    customerName: "Juan Pérez",
    phone: "573001112233",
    address: "Calle 45 #12-30, apto 501",
    items: [
      { name: "Bacon Burger", quantity: 2, unitPrice: 24900 },
      { name: "Papas Cheddar", quantity: 1, unitPrice: 12900 },
    ],
    deliveryFee: 5000,
    paymentMethod: "transferencia",
    status: "pending",
    minutesAgo: 3,
  },
  {
    code: "#1041",
    customerName: "María López",
    phone: "573002223344",
    address: "Carrera 9 #67-21",
    items: [{ name: "Pepperoni", quantity: 1, unitPrice: 28000 }],
    deliveryFee: 5000,
    paymentMethod: "datafono",
    status: "sent",
    minutesAgo: 22,
  },
  {
    code: "#1040",
    customerName: "Carlos Ruiz",
    phone: "573003334455",
    address: "Calle 80 #14-06",
    items: [
      { name: "Combo Burger", quantity: 1, unitPrice: 32900 },
      { name: "Coca-Cola", quantity: 1, unitPrice: 5000 },
    ],
    deliveryFee: 5000,
    paymentMethod: "efectivo",
    status: "delivered",
    minutesAgo: 96,
  },
  {
    code: "#1039",
    customerName: "Andrea Gómez",
    phone: "573004445566",
    address: "Transversal 21 #45-12",
    items: [
      { name: "Perro Especial", quantity: 2, unitPrice: 15900 },
      { name: "Limonada Natural", quantity: 2, unitPrice: 7900 },
    ],
    deliveryFee: 5000,
    paymentMethod: "efectivo",
    status: "preparing",
    minutesAgo: 12,
  },
  {
    code: "#1038",
    customerName: "Felipe Ortiz",
    phone: "573005556677",
    address: "Calle 127 #52-10",
    items: [{ name: "Combo Pizza", quantity: 1, unitPrice: 30900 }],
    deliveryFee: 5000,
    paymentMethod: "transferencia",
    status: "delivered",
    minutesAgo: 210,
  },
  {
    code: "#1037",
    customerName: "Laura Ramírez",
    phone: "573006667788",
    address: "Carrera 15 #88-40",
    items: [
      { name: "Clásica Burger", quantity: 1, unitPrice: 18900 },
      { name: "Brownie", quantity: 1, unitPrice: 10900 },
      { name: "Coca-Cola", quantity: 1, unitPrice: 5000 },
    ],
    deliveryFee: 5000,
    paymentMethod: "datafono",
    status: "sent",
    minutesAgo: 35,
  },
  {
    code: "#1036",
    customerName: "Diego Salazar",
    phone: "573007778899",
    address: "Calle 63 #7-18",
    items: [{ name: "Doble Carne", quantity: 1, unitPrice: 27900 }],
    deliveryFee: 5000,
    paymentMethod: "efectivo",
    status: "pending",
    minutesAgo: 6,
  },
  {
    code: "#1035",
    customerName: "Camila Torres",
    phone: "573008889900",
    address: "Carrera 30 #10-55",
    items: [
      { name: "Hawaiana", quantity: 1, unitPrice: 27000 },
      { name: "Limonada Natural", quantity: 1, unitPrice: 7900 },
    ],
    deliveryFee: 5000,
    paymentMethod: "transferencia",
    status: "delivered",
    minutesAgo: 320,
  },
  {
    code: "#1034",
    customerName: "Santiago Vargas",
    phone: "573009990011",
    address: "Calle 19 #4-22",
    items: [
      { name: "Perro Clásico", quantity: 3, unitPrice: 12900 },
    ],
    deliveryFee: 5000,
    paymentMethod: "efectivo",
    status: "preparing",
    minutesAgo: 18,
  },
  {
    code: "#1033",
    customerName: "Valentina Reyes",
    phone: "573001110022",
    address: "Carrera 50 #26-70",
    items: [{ name: "Combo Burger", quantity: 2, unitPrice: 32900 }],
    deliveryFee: 5000,
    paymentMethod: "transferencia",
    status: "delivered",
    minutesAgo: 480,
  },
];

export const DEMO_ORDERS: DemoOrder[] = RAW_ORDERS.map((order, i) => ({ id: i + 1, ...order }));

export const DASHBOARD_METRICS = {
  ordersToday: 24,
  salesToday: 685000,
  pendingOrders: 6,
  activeConversations: 8,
};

// --- Conversaciones ----------------------------------------------------------

export type ConversationMessage = {
  role: "customer" | "bot";
  text: string;
  minutesAgo: number;
};

export type DemoConversation = {
  id: number;
  customerName: string;
  phone: string;
  botPaused: boolean;
  escalationReason: string | null;
  windowMinutesLeft: number;
  messages: ConversationMessage[];
};

const RAW_CONVERSATIONS: Omit<DemoConversation, "id">[] = [
  {
    customerName: "Juan Pérez",
    phone: "573001112233",
    botPaused: false,
    escalationReason: null,
    windowMinutesLeft: 1430,
    messages: [
      { role: "customer", text: "Hola, buenas tardes", minutesAgo: 6 },
      { role: "bot", text: "¡Hola! Bienvenido. ¿Quieres ver el menú de hoy?", minutesAgo: 6 },
      { role: "customer", text: "Quiero una hamburguesa doble y unas papas", minutesAgo: 3 },
      {
        role: "bot",
        text: "Te dejo el link del menú para armar tu pedido y enviarlo desde ahí.",
        minutesAgo: 2,
      },
    ],
  },
  {
    customerName: "María López",
    phone: "573002223344",
    botPaused: false,
    escalationReason: null,
    windowMinutesLeft: 1200,
    messages: [
      { role: "customer", text: "¿Cuánto cuesta la pizza pepperoni?", minutesAgo: 5 },
      { role: "bot", text: "La Pepperoni cuesta $28.000. ¿Quieres agregarla al carrito?", minutesAgo: 5 },
    ],
  },
  {
    customerName: "Carlos Ruiz",
    phone: "573003334455",
    botPaused: false,
    escalationReason: null,
    windowMinutesLeft: 1050,
    messages: [
      { role: "customer", text: "Quiero hacer un pedido", minutesAgo: 10 },
      {
        role: "bot",
        text: "Perfecto, ábrelo desde el menú y cuando lo envíes yo te confirmo la dirección y el pago por acá.",
        minutesAgo: 10,
      },
    ],
  },
  {
    customerName: "Andrea Gómez",
    phone: "573004445566",
    botPaused: false,
    escalationReason: null,
    windowMinutesLeft: 980,
    messages: [
      { role: "customer", text: "#PEDIDO K3M9QZ", minutesAgo: 14 },
      {
        role: "bot",
        text: "¡Recibí tu pedido! ¿A qué dirección lo enviamos?",
        minutesAgo: 14,
      },
      { role: "customer", text: "Transversal 21 #45-12", minutesAgo: 13 },
      { role: "bot", text: "¿Pagas en efectivo o por transferencia?", minutesAgo: 13 },
      { role: "customer", text: "Efectivo", minutesAgo: 12 },
    ],
  },
  {
    customerName: "Felipe Ortiz",
    phone: "573005556677",
    botPaused: true,
    escalationReason: "El cliente pidió hablar con una persona.",
    windowMinutesLeft: 640,
    messages: [
      { role: "customer", text: "Mi pedido llegó incompleto, faltó la bebida", minutesAgo: 40 },
      {
        role: "bot",
        text: "Esa no te la sé responder bien, y prefiero no inventarte nada. Ya le avisé a una persona del equipo para que te ayude.",
        minutesAgo: 40,
      },
    ],
  },
  {
    customerName: "Laura Ramírez",
    phone: "573006667788",
    botPaused: false,
    escalationReason: null,
    windowMinutesLeft: 1300,
    messages: [
      { role: "customer", text: "¿Tienen algo sin carne?", minutesAgo: 40 },
      {
        role: "bot",
        text: "Sí, manejamos la Hamburguesa Vegetariana. ¿Te la muestro en el menú?",
        minutesAgo: 39,
      },
    ],
  },
  {
    customerName: "Diego Salazar",
    phone: "573007778899",
    botPaused: false,
    escalationReason: null,
    windowMinutesLeft: 1400,
    messages: [
      { role: "customer", text: "Hola", minutesAgo: 8 },
      {
        role: "bot",
        text: "¡Hola! Bienvenido a Sabor Urbano. Aquí tienes el menú para armar tu pedido 👇",
        minutesAgo: 8,
      },
    ],
  },
];

export const DEMO_CONVERSATIONS: DemoConversation[] = RAW_CONVERSATIONS.map((c, i) => ({
  id: i + 1,
  ...c,
}));

export const BOT_STATS = {
  messagesToday: 148,
  ordersGenerated: 21,
  lastMessageSecondsAgo: 8,
  whatsappConnected: true,
  catalogSynced: true,
};

// --- Catálogo ------------------------------------------------------------

export type DemoProduct = {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  available: boolean;
};

export const CATEGORIES = [
  "Hamburguesas",
  "Pizzas",
  "Perros",
  "Combos",
  "Entradas",
  "Bebidas",
  "Postres",
];

const RAW_PRODUCTS: Omit<DemoProduct, "id">[] = [
  { name: "Clásica Burger", description: "Carne a la brasa, queso cheddar, lechuga y tomate.", category: "Hamburguesas", price: 18900, available: true },
  { name: "Bacon Burger", description: "Doble carne, tocineta crocante y salsa de la casa.", category: "Hamburguesas", price: 24900, available: true },
  { name: "Doble Carne", description: "Dos carnes de 150 g con queso fundido.", category: "Hamburguesas", price: 27900, available: true },
  { name: "Hamburguesa Vegetariana", description: "Torta de garbanzo y quinua, aguacate.", category: "Hamburguesas", price: 17900, available: true },
  { name: "Pepperoni", description: "Mozzarella y pepperoni curado.", category: "Pizzas", price: 28000, available: true },
  { name: "Hawaiana", description: "Jamón, piña asada y mozzarella.", category: "Pizzas", price: 27000, available: true },
  { name: "Cuatro Carnes", description: "Res, cerdo, pepperoni y chorizo.", category: "Pizzas", price: 32900, available: false },
  { name: "Perro Clásico", description: "Salchicha ahumada, papa en hilo y salsas.", category: "Perros", price: 12900, available: true },
  { name: "Perro Especial", description: "Tocineta, queso mozzarella y piña asada.", category: "Perros", price: 15900, available: true },
  { name: "Combo Burger", description: "Clásica Burger + papas + bebida 400 ml.", category: "Combos", price: 32900, available: true },
  { name: "Combo Pizza", description: "Pizza personal + bebida 400 ml.", category: "Combos", price: 30900, available: true },
  { name: "Papas Cheddar", description: "Papas rústicas con cheddar fundido.", category: "Entradas", price: 12900, available: false },
  { name: "Aros de Cebolla", description: "Rebozado crocante, salsa de la casa.", category: "Entradas", price: 11500, available: true },
  { name: "Nachos de la Casa", description: "Totopos, carne desmechada y pico de gallo.", category: "Entradas", price: 16900, available: true },
  { name: "Coca-Cola", description: "Botella personal 400 ml.", category: "Bebidas", price: 5000, available: true },
  { name: "Limonada Natural", description: "Hecha al momento.", category: "Bebidas", price: 7900, available: true },
  { name: "Malteada", description: "Vainilla, chocolate o fresa.", category: "Bebidas", price: 13900, available: true },
  { name: "Brownie", description: "Chocolate 70%, nueces y salsa tibia.", category: "Postres", price: 10900, available: true },
  { name: "Cheesecake", description: "Base de galleta y frutos rojos.", category: "Postres", price: 12900, available: true },
];

export const DEMO_PRODUCTS: DemoProduct[] = RAW_PRODUCTS.map((p, i) => ({ id: i + 1, ...p }));
