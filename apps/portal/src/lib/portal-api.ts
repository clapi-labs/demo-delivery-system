/**
 * El único punto donde el portal habla con el backend.
 *
 * Las pantallas nunca llaman a `fetch` directo: llaman a estas funciones. Hoy
 * los pedidos y la lectura de la bandeja (`fetchConversations`) están
 * conectados de verdad (Neon, `app/api/orders` y `app/api/inbox`); pausar,
 * reactivar, responder y el menú siguen siendo enchufes listos, marcados con
 * `TODO(backend)`, que resuelven en memoria para que la interfaz se pueda
 * usar completa.
 *
 * Al conectar cada uno, la pantalla no cambia: se reemplaza el cuerpo de la
 * función. Las actualizaciones en pantalla ya son optimistas — si una llamada
 * falla, basta con lanzar el error y el provider correspondiente revierte.
 */

import { demoConversations, demoIncomingOrder, demoOrders } from "./demo-data";
import type { InboxConversation, InboxMessage } from "./inbox";
import type { MenuCategory, MenuProduct, Promotion } from "./menu";
import type { OrderStatus, PortalOrder } from "./orders";

/**
 * Modo demostración: pedidos ficticios en memoria en vez de Neon. Para grabar
 * el video o probar el portal sin base de datos. NUNCA en producción: un
 * restaurante que ve pedidos falsos los prepara.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_PORTAL_DEMO === "true";

// --- Pedidos (conectado) -----------------------------------------------------

let demoStore: PortalOrder[] | null = null;
let demoLoadedAt = 0;

export async function fetchOrders(): Promise<PortalOrder[]> {
  if (DEMO_MODE) {
    if (!demoStore) {
      demoStore = demoOrders();
      demoLoadedAt = Date.now();
    }
    // Un pedido entra solo a los 25 s, para ver el aviso de pedido nuevo.
    if (Date.now() - demoLoadedAt > 25_000 && !demoStore.some((o) => o.id === 15)) {
      demoStore = [demoIncomingOrder(), ...demoStore];
    }
    return demoStore.map((o) => ({ ...o }));
  }

  const res = await fetch("/api/orders", { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/orders → ${res.status}`);
  const data = (await res.json()) as { orders: PortalOrder[] };
  return data.orders;
}

/**
 * Cambia el estado de un pedido. Conectado a `POST /api/orders`.
 * TODO(backend): encolar el aviso al cliente en el outbox (RF-30) — hoy el
 * estado se guarda pero el cliente no se entera.
 */
export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<void> {
  if (DEMO_MODE) {
    demoStore = (demoStore ?? []).map((o) => (o.id === orderId ? { ...o, status } : o));
    return;
  }

  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, status }),
  });
  if (!res.ok) throw new Error(`POST /api/orders → ${res.status}`);
}

// --- Conversaciones (conectado el GET; el resto sigue TODO backend) ---------

/** Simula la latencia de red, para que los estados de "enviando" se vean. */
const later = (ms = 250) => new Promise((r) => setTimeout(r, ms));

/**
 * La bandeja, conectada a `GET /api/inbox` — una fila por número de WhatsApp
 * (`conversations.phone` es `unique()` en el esquema), con su hilo real.
 */
export async function fetchConversations(): Promise<InboxConversation[]> {
  if (DEMO_MODE) return demoConversations();

  const res = await fetch("/api/inbox", { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/inbox → ${res.status}`);
  const data = (await res.json()) as { conversations: InboxConversation[] };
  return data.conversations;
}

/**
 * TODO(backend): pausar el bot en esta conversación
 * (`conversations.bot_paused = true`). Abrir un chat NO lo pausa; esto sí.
 */
export async function pauseBot(conversationId: number): Promise<void> {
  void conversationId;
  await later();
}

/**
 * TODO(backend): devolverle la conversación al bot
 * (`bot_paused = false`, `escalation_reason = null`).
 */
export async function resumeBot(conversationId: number): Promise<void> {
  void conversationId;
  await later();
}

/**
 * TODO(backend): enviar un mensaje del equipo al cliente.
 *
 * Tiene que salir por `apps/bot` (`POST /api/internal/send`, RN-05: un solo
 * camino de salida), que comprueba la ventana de 24 h y registra el mensaje
 * con `role = "agent"`. Devuelve el mensaje tal como quedó guardado.
 */
export async function sendAgentMessage(conversationId: number, text: string): Promise<InboxMessage> {
  void conversationId;
  await later(400);
  return {
    id: `local-${Date.now()}`,
    role: "agent",
    kind: "text",
    text,
    createdAt: new Date().toISOString(),
  };
}

/** TODO(backend): marcar como leída (hoy no hay columna para esto). */
export async function markConversationRead(conversationId: number): Promise<void> {
  void conversationId;
}

// --- Menú (TODO backend) -----------------------------------------------------

/** TODO(backend): `products.available`. El menú público lo refleja al instante. */
export async function setProductAvailable(productId: number, available: boolean): Promise<void> {
  void productId;
  void available;
  await later(150);
}

/**
 * TODO(backend): crear o actualizar un producto con sus grupos de opciones.
 * La imagen llega como `File` aparte: subirla exige almacenamiento externo
 * (en Vercel el disco se borra), ver "Pendiente de decidir" en STATUS.md.
 */
export async function saveProduct(product: MenuProduct, image?: File | null): Promise<MenuProduct> {
  void image;
  await later();
  return product;
}

/** TODO(backend): borrar producto (o marcarlo archivado, para no romper
 *  pedidos viejos que lo referencian por nombre). */
export async function deleteProduct(productId: number): Promise<void> {
  void productId;
  await later();
}

/** TODO(backend): `categories` — nombre, símbolo (columna `emoji`), `active` y `sort_order`. */
export async function saveCategories(categories: MenuCategory[]): Promise<void> {
  void categories;
  await later(150);
}

/** TODO(backend): `products.sort_order` dentro de su categoría. */
export async function saveProductOrder(productIds: number[]): Promise<void> {
  void productIds;
  await later(150);
}

/**
 * TODO(backend): las promociones no tienen tabla todavía. La forma propuesta
 * está en `src/lib/menu.ts` (`Promotion`). Ojo con RN-02: el descuento se
 * calcula en el servidor al crear el pedido, nunca en el navegador.
 */
export async function savePromotion(promotion: Promotion): Promise<Promotion> {
  await later();
  return promotion;
}

export async function deletePromotion(promotionId: number): Promise<void> {
  void promotionId;
  await later();
}
