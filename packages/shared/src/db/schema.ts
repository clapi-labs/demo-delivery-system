import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { CourierKind, CourierPayment } from "../domain/delivery";
import type { OrderStatus } from "../domain/order-status";
import type { PaymentMethod } from "../domain/payment";
import type { PromotionKind, PromotionScope } from "../domain/promotions";

/**
 * Esquema del sistema.
 *
 * Un solo restaurante: no hay multi-tenant. Lo que identifica a un cliente es
 * su **teléfono** (el `wa_id` de WhatsApp), igual que en el sistema real.
 *
 * Precios en pesos colombianos, enteros. El COP no maneja centavos, así que
 * guardar "centavos" sería inventar una precisión que no existe.
 */

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  emoji: text("emoji"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  /** Identificador estable. Es lo que viaja en el link `?add=`. */
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: integer("price").notNull(),
  imageUrl: text("image_url"),
  emoji: text("emoji"),
  available: boolean("available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** Un grupo de personalización: "Término de la carne", "Extras". */
export const optionGroups = pgTable("option_groups", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** "single" = elige uno, "multi" = elige varios. */
  type: text("type").notNull().$type<"single" | "multi">(),
  required: boolean("required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const options = pgTable("options", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id")
    .notNull()
    .references(() => optionGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceDelta: integer("price_delta").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * Promociones (Fase 5).
 *
 * `scope` y `days` van en `jsonb` a propósito: una promoción apunta a un
 * puñado de categorías o productos, y una tabla puente para eso sería tres
 * consultas más por cada vez que el bot contesta "¿qué hay hoy?". La forma la
 * define `domain/promotions.ts`, que es lo que importan las tres apps.
 *
 * Las horas se guardan como texto "HH:MM" en hora del negocio, no como
 * `timestamp`: una promo de 3 a 6 p.m. no ocurre un día concreto, se repite.
 */
export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().$type<PromotionKind>(),
  /** Porcentaje para `percent`, precio final para `price`, 0 para 2x1. */
  value: integer("value").notNull().default(0),
  scope: jsonb("scope").notNull().$type<PromotionScope>().default({ type: "all" }),
  /** 0 = domingo … 6 = sábado. */
  days: jsonb("days").notNull().$type<number[]>().default([0, 1, 2, 3, 4, 5, 6]),
  fromTime: text("from_time"),
  toTime: text("to_time"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Conversaciones
// ---------------------------------------------------------------------------

export type ConversationPhase =
  | "advising"
  | "collecting_address"
  | "awaiting_payment"
  | "awaiting_voucher";

export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    /** El `wa_id` de WhatsApp: el teléfono en formato internacional sin `+`. */
    phone: text("phone").notNull().unique(),
    /** El nombre del perfil de WhatsApp, cuando Meta lo manda. */
    displayName: text("display_name"),

    phase: text("phase")
      .notNull()
      .$type<ConversationPhase>()
      .default("advising"),
    activeOrderId: integer("active_order_id"),

    /**
     * El control del asistente. `botPaused` lo mueven tres cosas: que el bot
     * escale, que un agente responda desde el portal, o que el cliente escriba
     * "reiniciar".
     */
    botPaused: boolean("bot_paused").notNull().default(false),
    escalationReason: text("escalation_reason"),

    /**
     * Cuándo escribió el cliente por última vez.
     *
     * **No es cosmético: es la ventana de servicio de 24 horas de WhatsApp.**
     * Fuera de ella, Meta rechaza cualquier mensaje libre y solo acepta
     * plantillas aprobadas. Todo envío saliente consulta este campo antes de
     * intentar nada — ver `packages/shared/src/domain/session-window.ts`.
     */
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("conversations_last_message_idx").on(t.lastMessageAt)],
);

export type MessageRole = "customer" | "bot" | "agent";
export type MessageKind = "text" | "audio" | "image" | "button" | "system";

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<MessageRole>(),
    kind: text("kind").notNull().$type<MessageKind>().default("text"),
    /** Para audio: la transcripción. Para imagen: lo que se leyó, si algo. */
    text: text("text").notNull().default(""),

    /** El id que da Meta. Sirve para trazar y para no duplicar. */
    waMessageId: text("wa_message_id"),
    /** Ruta local del adjunto, cuando se guardó (audio, comprobante). */
    mediaPath: text("media_path"),

    /** Botones, link al menú, etiquetas: lo que la interfaz necesita para
     *  pintar el mensaje sin volver a razonarlo. */
    meta: jsonb("meta").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.id)],
);

/**
 * Idempotencia del webhook.
 *
 * Meta **reintenta** la entrega si no respondemos 200 a tiempo, así que el
 * mismo mensaje puede llegar más de una vez. Sin esta tabla, un reintento
 * significa que el cliente recibe la respuesta dos veces — o peor, que un
 * pedido se procesa dos veces.
 *
 * En el sistema real esto vive en Redis; acá basta Postgres y una limpieza
 * periódica de lo viejo.
 */
export const processedMessages = pgTable("processed_messages", {
  waMessageId: text("wa_message_id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

/** Definido en `domain/order-status.ts` — ver ahí por qué no vive en este
 *  archivo. Se reexporta para que `@sistema/shared/db` siga sirviéndolo. */
export type { OrderStatus };

export type SelectedOption = {
  group: string;
  name: string;
  priceDelta: number;
};

/** Lo elige el cliente en el MENÚ, junto con la dirección, no por chat: para
 *  cuando el pedido llega al bot ya está decidido. Definido en `domain/` —
 *  ver el comentario de ahí sobre por qué no vive en este archivo. */
export type { PaymentMethod };

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    /** Código de un solo uso que viaja del menú al chat. */
    code: text("code").notNull().unique(),
    /** De quién es. Se resuelve del token firmado del link, no del navegador. */
    phone: text("phone"),

    status: text("status").notNull().$type<OrderStatus>().default("draft"),
    /**
     * Siempre "menu". Existe para que el candado —un pedido no puede nacer de
     * una conversación— sea verificable en la base, no solo en el código.
     */
    source: text("source").notNull().default("menu"),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),

    customerName: text("customer_name"),
    address: text("address"),
    addressNotes: text("address_notes"),
    paymentMethod: text("payment_method").$type<PaymentMethod>(),

    subtotal: integer("subtotal").notNull(),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    total: integer("total").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_phone_idx").on(t.phone),
  ],
);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  /** Nombre y precio congelados: si el catálogo cambia, el pedido histórico
   *  no se reescribe solo. */
  nameSnapshot: text("name_snapshot").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  selectedOptions: jsonb("selected_options")
    .notNull()
    .$type<SelectedOption[]>()
    .default([]),
  lineTotal: integer("line_total").notNull(),
});

// ---------------------------------------------------------------------------
// Logística: quién se lleva el pedido
// ---------------------------------------------------------------------------

/** Ver `domain/delivery.ts` por qué los tipos no viven en este archivo. */
export type { CourierKind, CourierPayment };

/**
 * La libreta de quién reparte: domiciliarios propios y flotas externas.
 *
 * **Una sola tabla con `kind`, no dos.** Un domiciliario fijo y una agencia
 * son lo mismo para el pedido —alguien a quien se le entrega y a quien se le
 * manda una ficha por WhatsApp—; lo único que cambia es quién marca la
 * entrega. Dos tablas obligarían a unir o a duplicar cada consulta del
 * tablero y del arqueo para no ganar nada.
 */
export const couriers = pgTable("couriers", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().$type<CourierKind>().default("internal"),
  name: text("name").notNull(),
  /** Internacional sin `+`: es un `wa_id`, el mismo formato que el cliente. */
  phone: text("phone").notNull(),
  /**
   * Cómo cobra una flota externa lo que recoge. Nulo en los propios: a un
   * domiciliario de la casa no se le liquida por pedido.
   */
  paymentMode: text("payment_mode").$type<CourierPayment>(),
  /** Lo que el restaurante quiera recordar: turno, placa, tarifa acordada. */
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * La asignación de un pedido a quien lo lleva. Una fila por pedido.
 *
 * **Nombre y modalidad van congelados**, como el nombre del producto en
 * `order_items` y por la misma razón: borrar un domiciliario no puede
 * reescribir el arqueo de la semana pasada. `courier_id` queda en nulo y la
 * fila sigue contando quién lo llevó.
 *
 * Las cuatro marcas de tiempo son el recibo de la operación: cuándo se
 * asignó, cuándo se le avisó por WhatsApp, cuándo salió del local y cuándo
 * llegó. Sin ellas, "¿a qué hora salió ese pedido?" no tiene respuesta.
 */
export const deliveries = pgTable(
  "deliveries",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    courierId: integer("courier_id").references(() => couriers.id, {
      onDelete: "set null",
    }),
    courierName: text("courier_name").notNull(),
    kind: text("kind").notNull().$type<CourierKind>(),
    paymentMode: text("payment_mode").$type<CourierPayment>(),
    /** El "M-12" que contesta la agencia en el chat. Opcional a propósito:
     *  el pedido sale igual si nadie lo escribe. */
    vehicleCode: text("vehicle_code"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    // Un pedido tiene un solo responsable: reasignar SUSTITUYE la fila, no
    // agrega una segunda. Que lo garantice la base y no el código.
    uniqueIndex("deliveries_order_idx").on(t.orderId),
    index("deliveries_courier_idx").on(t.courierId),
  ],
);

/**
 * Outbox de avisos al cliente.
 *
 * El portal escribe acá al cambiar un estado y el bot lo barre para enviarlo
 * por WhatsApp. No es una llamada directa a propósito: que Meta esté caída o
 * que la ventana de 24 h esté cerrada no puede bloquear un cambio de estado en
 * la cocina.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    orderId: integer("order_id").references(() => orders.id, {
      onDelete: "cascade",
    }),
    text: text("text").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notifications_pending_idx").on(t.deliveredAt, t.id)],
);

// ---------------------------------------------------------------------------
// Comprobantes de pago
// ---------------------------------------------------------------------------

export type VoucherStatus = "pending" | "validated" | "review";

/**
 * El comprobante de una transferencia.
 *
 * Regla heredada del sistema real: **la imagen se guarda siempre**, valide o
 * no. Un comprobante que el sistema no pudo leer sigue siendo la prueba de que
 * el cliente pagó, y alguien va a tener que mirarlo.
 */
export const vouchers = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, {
    onDelete: "cascade",
  }),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),

  mediaPath: text("media_path").notNull(),
  status: text("status").notNull().$type<VoucherStatus>().default("pending"),

  /** Lo que se leyó de la imagen. Nulo si no se pudo. */
  amount: integer("amount"),
  reference: text("reference"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  /** Por qué quedó en revisión, en una frase que lea una persona. */
  reviewReason: text("review_reason"),
  rawExtraction: jsonb("raw_extraction").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Una referencia ya usada no se acepta dos veces. */
export const voucherReferences = pgTable(
  "voucher_references",
  {
    reference: text("reference").primaryKey(),
    voucherId: integer("voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("voucher_references_idx").on(t.reference)],
);
