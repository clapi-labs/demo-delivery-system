/**
 * El único punto donde el portal habla con el backend.
 *
 * Las pantallas nunca llaman a `fetch` directo: llaman a estas funciones. Hoy
 * los pedidos y toda la bandeja (lectura, pausar, reactivar y responder)
 * están conectados de verdad (Neon vía `app/api/orders`/`app/api/inbox`, y
 * responder además sale por `apps/bot`). El menú sigue siendo un enchufe
 * listo, marcado con `TODO(backend)`, que resuelve en memoria para que la
 * interfaz se pueda usar completa.
 *
 * Al conectar cada uno, la pantalla no cambia: se reemplaza el cuerpo de la
 * función. Las actualizaciones en pantalla ya son optimistas — si una llamada
 * falla, basta con lanzar el error y el provider correspondiente revierte.
 */

import { demoConversations, demoIncomingOrder, demoMenu, demoOrders, demoPromotions } from "./demo-data";
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

// --- Conversaciones (conectado) ----------------------------------------------

/** Solo para DEMO_MODE: simula la latencia de red. */
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

async function postInbox(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string; message?: InboxMessage }> {
  const res = await fetch("/api/inbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; error?: string; message?: InboxMessage }
    | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? `POST /api/inbox → ${res.status}`);
  return data;
}

/** Pausar el bot en esta conversación. Abrir un chat NO lo pausa; esto sí. */
export async function pauseBot(conversationId: number): Promise<void> {
  if (DEMO_MODE) {
    await later();
    return;
  }
  await postInbox({ action: "pause", conversationId });
}

/** Devolverle la conversación al bot. */
export async function resumeBot(conversationId: number): Promise<void> {
  if (DEMO_MODE) {
    await later();
    return;
  }
  await postInbox({ action: "resume", conversationId });
}

/**
 * Un mensaje del equipo al cliente. Sale por `apps/bot`
 * (`POST /api/internal/send`, RN-05: un solo camino de salida), que
 * comprueba `BOT_ACTIVE` y la ventana de 24 h antes de intentar nada — si
 * cualquiera falla, esto lanza y el provider revierte lo optimista.
 */
export async function sendAgentMessage(conversationId: number, text: string): Promise<InboxMessage> {
  if (DEMO_MODE) {
    await later(400);
    return { id: `local-${Date.now()}`, role: "agent", kind: "text", text, createdAt: new Date().toISOString() };
  }

  const data = await postInbox({ action: "send", conversationId, text });
  if (!data.message) throw new Error("send_failed");
  return data.message;
}

/** TODO(backend): marcar como leída (hoy no hay columna para esto). */
export async function markConversationRead(conversationId: number): Promise<void> {
  void conversationId;
}

// --- Menú (conectado, menos editar productos) --------------------------------

async function postMenu(body: Record<string, unknown>): Promise<{ promotion?: Promotion }> {
  const res = await fetch("/api/menu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; error?: string; promotion?: Promotion }
    | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? `POST /api/menu → ${res.status}`);
  return data;
}

/**
 * El catálogo real y las promociones (`GET /api/menu`).
 *
 * Es el mismo catálogo que ve el cliente en el menú público y que consulta el
 * bot: una sola tabla, no una copia.
 */
export async function fetchMenu(): Promise<{
  categories: MenuCategory[];
  products: MenuProduct[];
  promotions: Promotion[];
}> {
  if (DEMO_MODE) {
    const { categories, products } = demoMenu();
    return { categories, products, promotions: demoPromotions() };
  }

  const res = await fetch("/api/menu", { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/menu → ${res.status}`);
  return (await res.json()) as { categories: MenuCategory[]; products: MenuProduct[]; promotions: Promotion[] };
}

/** `products.available`. El menú público y el bot lo reflejan al instante:
 *  los dos leen esta misma columna en cada consulta. */
export async function setProductAvailable(productId: number, available: boolean): Promise<void> {
  if (DEMO_MODE) {
    await later(150);
    return;
  }
  await postMenu({ action: "available", productId, available });
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
 * Crear o editar una promoción (`id === 0` es nueva).
 *
 * Devuelve la promoción **como quedó en la base**, no como se mandó: al crear,
 * el id de verdad lo asigna Postgres, y la pantalla tiene que quedarse con ese
 * y no con el provisional, o el siguiente "guardar" crearía una segunda.
 */
export async function savePromotion(promotion: Promotion): Promise<Promotion> {
  if (DEMO_MODE) {
    await later();
    return promotion;
  }
  const data = await postMenu({ action: "promotion", promotion });
  return data.promotion ?? promotion;
}

/** Prender o apagar una promoción sin abrir el editor. */
export async function setPromotionActive(promotionId: number, active: boolean): Promise<void> {
  if (DEMO_MODE) {
    await later(150);
    return;
  }
  await postMenu({ action: "promotion-active", promotionId, active });
}

export async function deletePromotion(promotionId: number): Promise<void> {
  if (DEMO_MODE) {
    await later();
    return;
  }
  await postMenu({ action: "promotion-delete", promotionId });
}
