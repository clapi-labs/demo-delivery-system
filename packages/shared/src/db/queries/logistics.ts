import { and, asc, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";

import type { CourierKind, CourierPayment } from "../../domain/delivery";
import { db } from "../client";
import { couriers, deliveries, orders } from "../schema";

/**
 * La libreta de repartidores y la asignación de cada pedido (RF-49 a RF-54).
 *
 * Vive en `shared` y no en el portal porque la usan tres sitios: el portal
 * (asignar, el arqueo), la pantalla del repartidor (sus pedidos, marcar
 * entrega) y el bot (la ficha que le manda al domiciliario propio).
 *
 * Todo lo que escribe acá **congela** el nombre y la modalidad en la fila de
 * `deliveries`. Es la misma regla de `order_items` con el nombre del producto:
 * el historial no se reescribe porque alguien borró un domiciliario.
 */

export type Courier = {
  id: number;
  kind: CourierKind;
  name: string;
  phone: string;
  paymentMode: CourierPayment | null;
  notes: string | null;
  active: boolean;
  sortOrder: number;
};

export type Delivery = {
  orderId: number;
  courierId: number | null;
  courierName: string;
  kind: CourierKind;
  paymentMode: CourierPayment | null;
  vehicleCode: string | null;
  assignedAt: Date;
  notifiedAt: Date | null;
  dispatchedAt: Date | null;
  deliveredAt: Date | null;
};

// --- La libreta ---------------------------------------------------------------

/** Los propios primero y dentro de cada grupo por orden manual: es el orden en
 *  el que el cajero los busca, no el alfabético. */
export async function listCouriers({ includeInactive = false } = {}): Promise<Courier[]> {
  const rows = await db
    .select()
    .from(couriers)
    .where(includeInactive ? undefined : eq(couriers.active, true))
    .orderBy(asc(couriers.kind), asc(couriers.sortOrder), asc(couriers.id));

  return rows.map((c) => ({
    id: c.id,
    kind: c.kind,
    name: c.name,
    phone: c.phone,
    paymentMode: c.paymentMode,
    notes: c.notes,
    active: c.active,
    sortOrder: c.sortOrder,
  }));
}

export type CourierInput = {
  id?: number;
  kind: CourierKind;
  name: string;
  phone: string;
  paymentMode?: CourierPayment | null;
  notes?: string | null;
  active?: boolean;
  sortOrder?: number;
};

/**
 * Crear o actualizar. Devuelve la fila como quedó en la base: al crear, el id
 * lo asigna Postgres y quien llama tiene que quedarse con ese.
 */
export async function saveCourier(input: CourierInput): Promise<Courier> {
  // Una agencia sin modalidad de cobro deja al cajero adivinando en cada
  // pedido; el efectivo es lo que hacen casi todas, así que es el que se
  // asume. Un propio nunca lleva modalidad: no se le liquida por pedido.
  const paymentMode =
    input.kind === "agency" ? (input.paymentMode ?? "cash_base") : null;

  const values = {
    kind: input.kind,
    name: input.name.trim(),
    phone: input.phone.replace(/\D/g, ""),
    paymentMode,
    notes: input.notes?.trim() || null,
    active: input.active ?? true,
    sortOrder: input.sortOrder ?? 0,
  };

  if (input.id) {
    const [updated] = await db
      .update(couriers)
      .set(values)
      .where(eq(couriers.id, input.id))
      .returning();
    if (updated) return { ...values, id: updated.id };
  }

  const [created] = await db.insert(couriers).values(values).returning();
  return { ...values, id: created.id };
}

export async function setCourierActive(id: number, active: boolean) {
  await db.update(couriers).set({ active }).where(eq(couriers.id, id));
}

/**
 * Borrar del todo.
 *
 * Las asignaciones ya hechas **no se van con él** (`courier_id` queda en nulo
 * y el nombre congelado sigue en la fila), así que el arqueo del día que
 * trabajó se mantiene.
 */
export async function deleteCourier(id: number) {
  await db.delete(couriers).where(eq(couriers.id, id));
}

export async function getCourier(id: number): Promise<Courier | null> {
  const list = await listCouriers({ includeInactive: true });
  return list.find((c) => c.id === id) ?? null;
}

// --- La asignación ------------------------------------------------------------

function toDelivery(row: typeof deliveries.$inferSelect): Delivery {
  return {
    orderId: row.orderId,
    courierId: row.courierId,
    courierName: row.courierName,
    kind: row.kind,
    paymentMode: row.paymentMode,
    vehicleCode: row.vehicleCode,
    assignedAt: row.assignedAt,
    notifiedAt: row.notifiedAt,
    dispatchedAt: row.dispatchedAt,
    deliveredAt: row.deliveredAt,
  };
}

/**
 * Asignar un pedido a quien lo lleva. Reasignar **sustituye**: un pedido tiene
 * un solo responsable, y eso lo garantiza el índice único de `order_id`.
 *
 * Devuelve `null` si el domiciliario no existe (lo borraron entre que el
 * cajero abrió la hoja y tocó asignar) o si el pedido es un borrador — por lo
 * mismo que el portal nunca mueve borradores (ADR-02).
 */
export async function assignDelivery(
  orderId: number,
  courierId: number,
  opts: { paymentMode?: CourierPayment | null; vehicleCode?: string | null } = {},
): Promise<Delivery | null> {
  const courier = await getCourier(courierId);
  if (!courier) return null;

  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, orderId), ne(orders.status, "draft")))
    .limit(1);
  if (!order) return null;

  const values = {
    orderId,
    courierId: courier.id,
    courierName: courier.name,
    kind: courier.kind,
    paymentMode:
      courier.kind === "agency" ? (opts.paymentMode ?? courier.paymentMode ?? "cash_base") : null,
    vehicleCode: opts.vehicleCode?.trim() || null,
    assignedAt: new Date(),
    notifiedAt: null,
    dispatchedAt: null,
    deliveredAt: null,
  };

  const [row] = await db
    .insert(deliveries)
    .values(values)
    .onConflictDoUpdate({ target: deliveries.orderId, set: values })
    .returning();

  return toDelivery(row);
}

/** El "M-12" que contesta la agencia. Se puede escribir antes o después de
 *  despachar; es un dato de auditoría, no un paso obligatorio. */
export async function setDeliveryVehicle(orderId: number, vehicleCode: string | null) {
  const [row] = await db
    .update(deliveries)
    .set({ vehicleCode: vehicleCode?.trim() || null })
    .where(eq(deliveries.orderId, orderId))
    .returning();
  return row ? toDelivery(row) : null;
}

export async function markDeliveryNotified(orderId: number) {
  await db.update(deliveries).set({ notifiedAt: new Date() }).where(eq(deliveries.orderId, orderId));
}

/**
 * Las marcas de tiempo que deja el cambio de estado del pedido.
 *
 * No es el portal el que decide cuándo "salió" un pedido: salió cuando alguien
 * lo pasó a *Enviado*. Así la hora de salida y la del tablero son la misma
 * por construcción, y no dos datos que se pueden contradecir.
 *
 * Silencioso si el pedido no tiene asignación: mover una comanda no puede
 * fallar porque nadie haya elegido repartidor.
 */
export async function stampDelivery(orderId: number, status: string) {
  if (status === "sent") {
    await db
      .update(deliveries)
      .set({ dispatchedAt: new Date() })
      .where(and(eq(deliveries.orderId, orderId), isNull(deliveries.dispatchedAt)));
    return;
  }

  if (status === "delivered") {
    const now = new Date();
    await db
      .update(deliveries)
      .set({ deliveredAt: now })
      .where(and(eq(deliveries.orderId, orderId), isNull(deliveries.deliveredAt)));
    // Un pedido que se marca entregado sin haber pasado por "enviado" (pasa
    // cuando el cajero corrige a la carrera) igual tiene que tener hora de
    // salida, o el arqueo queda con un hueco.
    await db
      .update(deliveries)
      .set({ dispatchedAt: now })
      .where(and(eq(deliveries.orderId, orderId), isNull(deliveries.dispatchedAt)));
  }
}

/** Las asignaciones de un puñado de pedidos, para pintar el tablero. */
export async function deliveriesByOrder(orderIds: number[]): Promise<Map<number, Delivery>> {
  if (orderIds.length === 0) return new Map();
  const rows = await db.select().from(deliveries).where(inArray(deliveries.orderId, orderIds));
  return new Map(rows.map((r) => [r.orderId, toDelivery(r)]));
}

// --- La pantalla del repartidor ----------------------------------------------

export type CourierTask = {
  orderId: number;
  code: string;
  customerName: string | null;
  phone: string | null;
  address: string | null;
  addressNotes: string | null;
  total: number;
  paymentMethod: string | null;
  status: string;
  assignedAt: Date;
  dispatchedAt: Date | null;
  deliveredAt: Date | null;
};

/**
 * Lo que tiene que llevar un domiciliario: lo de hoy, sin lo ya cerrado.
 *
 * Se filtra por fecha y no solo por estado para que su pantalla no crezca sin
 * límite: lo que entregó anteayer no le sirve de nada, y una lista larga en un
 * celular al sol es una lista que no se lee.
 */
export async function courierTasks(courierId: number, since: Date): Promise<CourierTask[]> {
  const rows = await db
    .select({
      orderId: orders.id,
      code: orders.code,
      customerName: orders.customerName,
      phone: orders.phone,
      address: orders.address,
      addressNotes: orders.addressNotes,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      status: orders.status,
      assignedAt: deliveries.assignedAt,
      dispatchedAt: deliveries.dispatchedAt,
      deliveredAt: deliveries.deliveredAt,
    })
    .from(deliveries)
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .where(
      and(
        eq(deliveries.courierId, courierId),
        ne(orders.status, "cancelled"),
        or(isNull(deliveries.deliveredAt), gte(deliveries.assignedAt, since)),
      ),
    )
    .orderBy(asc(deliveries.assignedAt));

  return rows;
}

// --- El arqueo ----------------------------------------------------------------

export type CourierSettlement = {
  courierId: number | null;
  courierName: string;
  kind: CourierKind;
  /** Pedidos entregados por esta persona o agencia. */
  delivered: number;
  /** Pedidos asignados que todavía no llegaron. */
  pending: number;
  /** Lo vendido en lo que ya entregó. */
  total: number;
  /** De lo entregado, lo que el mensajero cobró en efectivo al cliente. */
  cash: number;
  /** De lo entregado, lo que va a la cuenta de la agencia. */
  account: number;
};

/**
 * El cierre de turno: quién llevó qué y cómo se cobra.
 *
 * Es el "a quién le debo qué" al final del día, que es la pregunta que hoy se
 * responde de memoria. Se cuenta sobre lo **entregado**, no sobre lo asignado:
 * un pedido que salió y volvió no se le liquida a nadie.
 *
 * Los pedidos cancelados quedan fuera. El efectivo se mira contra el método de
 * pago del pedido, no contra la modalidad de la agencia: el que manda es lo
 * que el cliente hizo.
 */
export async function settlement(since: Date, until: Date): Promise<CourierSettlement[]> {
  const rows = await db
    .select({
      courierId: deliveries.courierId,
      courierName: deliveries.courierName,
      kind: deliveries.kind,
      paymentMode: deliveries.paymentMode,
      deliveredAt: deliveries.deliveredAt,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      status: orders.status,
    })
    .from(deliveries)
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .where(
      and(
        ne(orders.status, "cancelled"),
        gte(deliveries.assignedAt, since),
        lt(deliveries.assignedAt, until),
      ),
    );

  const byCourier = new Map<string, CourierSettlement>();

  for (const row of rows) {
    // La clave es el nombre congelado, no el id: un domiciliario borrado
    // (`courier_id` nulo) tiene que seguir apareciendo con su nombre en el
    // arqueo del día que trabajó, y no agruparse con los demás borrados.
    const key = `${row.kind}:${row.courierName}`;
    const entry =
      byCourier.get(key) ??
      ({
        courierId: row.courierId,
        courierName: row.courierName,
        kind: row.kind,
        delivered: 0,
        pending: 0,
        total: 0,
        cash: 0,
        account: 0,
      } satisfies CourierSettlement);

    // Cuenta como entregado si lo marcó el repartidor **o** si el pedido ya
    // está cerrado en el tablero: si solo se mirara la marca del repartidor,
    // un pedido que el cajero cerró a mano se quedaría "en la calle" para
    // siempre y el arqueo no cuadraría nunca.
    if (row.deliveredAt || row.status === "delivered") {
      entry.delivered += 1;
      entry.total += row.total;
      const toAccount = row.kind === "agency" && row.paymentMode === "account";
      if (toAccount) entry.account += row.total;
      else if (row.paymentMethod === "efectivo" || row.paymentMethod === null) entry.cash += row.total;
    } else {
      entry.pending += 1;
    }

    byCourier.set(key, entry);
  }

  return [...byCourier.values()].sort((a, b) => b.total - a.total || a.courierName.localeCompare(b.courierName));
}
