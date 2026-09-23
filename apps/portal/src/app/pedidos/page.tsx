"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatCOP, formatPhone } from "@sistema/shared";

import { Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ORDER_STATUS_ACTION_LABEL,
  ORDER_STATUS_LABEL,
  minutesSince,
  nextOrderStatus,
  paymentLabel,
  relativeTime,
  type OrderStatus,
} from "@/lib/demo-data";

/** Lo que devuelve `GET /api/orders` — el pedido real, ya sin borradores. */
type PortalOrder = {
  id: number;
  code: string;
  status: OrderStatus;
  phone: string | null;
  customerName: string | null;
  address: string | null;
  paymentMethod: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    options: { group: string; name: string; priceDelta: number }[];
  }[];
};

const TABS: { label: string; status: OrderStatus | "all" }[] = [
  { label: "Todos", status: "all" },
  { label: "Nuevos", status: "pending" },
  { label: "En preparación", status: "preparing" },
  { label: "Enviados", status: "sent" },
  { label: "Entregados", status: "delivered" },
];

/** Cada cuánto se refresca el tablero. Un pedido que entra tiene que
 *  aparecer solo: nadie en una cocina va a estar recargando la página. */
const POLL_MS = 5000;

function itemsSummary(order: PortalOrder) {
  return order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<OrderStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) return;
      const data = (await res.json()) as { orders: PortalOrder[] };
      setOrders(data.orders);
    } catch {
      // Un fallo de red puntual no borra lo que ya está en pantalla: la cocina
      // prefiere datos de hace 5 segundos que una tabla vacía.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Traer del servidor ES sincronizar con un sistema externo, que es
    // justo para lo que sirve un efecto; la regla apunta a otra cosa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => tab === "all" || o.status === tab)
      .filter(
        (o) =>
          !q ||
          o.code.toLowerCase().includes(q) ||
          (o.customerName ?? "").toLowerCase().includes(q) ||
          (o.phone ?? "").includes(q),
      );
  }, [orders, tab, query]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  const advance = async (order: PortalOrder) => {
    const next = nextOrderStatus(order.status);
    if (!next) return;

    // Optimista: la cocina ve el cambio al instante y el servidor confirma
    // detrás. Si falla, el siguiente sondeo lo devuelve a su estado real.
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));

    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, status: next }),
    }).catch(() => {});

    load();
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-xl font-semibold">Pedidos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Todo lo que llega desde el menú y el bot de WhatsApp.
      </p>

      <div className="mt-6 flex items-center justify-between gap-6 border-b border-border">
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.status}
              onClick={() => setTab(t.status)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === t.status
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por pedido, cliente o teléfono…"
          className="mb-2 h-9 w-72 rounded-md border border-border bg-surface px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      <ul className="mt-2 divide-y divide-border">
        {loading ? (
          <li className="py-10 text-center text-sm text-muted-foreground">Cargando…</li>
        ) : filtered.length === 0 ? (
          <li className="py-10 text-center text-sm text-muted-foreground">
            {orders.length === 0
              ? "Todavía no hay pedidos. Cuando un cliente envíe el suyo desde el menú, aparece acá solo."
              : "No hay pedidos que coincidan."}
          </li>
        ) : (
          filtered.map((order) => (
            <li key={order.id} className="grid grid-cols-12 items-center gap-4 py-4">
              <div className="col-span-3">
                <p className="font-semibold">{order.code}</p>
                <p className="text-sm text-muted-foreground">
                  {order.customerName ?? (order.phone ? formatPhone(order.phone) : "Sin nombre")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {relativeTime(minutesSince(order.createdAt))}
                </p>
              </div>
              <div className="col-span-4 text-sm text-muted-foreground">
                {itemsSummary(order)}
              </div>
              <div className="col-span-1 text-sm font-medium tabular-nums">
                {formatCOP(order.total)}
              </div>
              <div className="col-span-2 text-sm text-muted-foreground">
                {paymentLabel(order.paymentMethod)}
              </div>
              <div className="col-span-1">
                <StatusBadge status={order.status} />
              </div>
              <div className="col-span-1 text-right">
                <button
                  onClick={() => setSelectedId(order.id)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
                >
                  Ver pedido
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <Panel
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected?.code ?? ""}
        subtitle={selected ? relativeTime(minutesSince(selected.createdAt)) : undefined}
        footer={
          selected ? (
            <div className="flex items-center justify-between gap-3">
              <StatusBadge status={selected.status} />
              {nextOrderStatus(selected.status) ? (
                <button
                  onClick={() => advance(selected)}
                  className="h-10 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
                >
                  {ORDER_STATUS_ACTION_LABEL[selected.status]}
                </button>
              ) : (
                <p className="text-sm text-muted-foreground">Pedido entregado.</p>
              )}
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-6">
            <section>
              <p className="eyebrow">Información del pedido</p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Cliente</dt>
                  <dd className="font-medium">{selected.customerName ?? "Sin nombre"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Teléfono</dt>
                  <dd>{selected.phone ? formatPhone(selected.phone) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="shrink-0 text-muted-foreground">Dirección</dt>
                  <dd className="text-right">{selected.address ?? "Sin confirmar"}</dd>
                </div>
              </dl>
            </section>

            <section>
              <p className="eyebrow">Productos</p>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 font-medium">Producto</th>
                    <th className="py-2 text-center font-medium">Cant.</th>
                    <th className="py-2 text-right font-medium">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2">
                        {item.name}
                        {item.options.length > 0 ? (
                          <span className="block text-xs text-muted-foreground">
                            {item.options.map((o) => o.name).join(", ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-center tabular-nums">{item.quantity}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCOP(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCOP(selected.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Domicilio</span>
                <span className="tabular-nums">{formatCOP(selected.deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCOP(selected.total)}</span>
              </div>
              <div className="flex justify-between pt-1 text-muted-foreground">
                <span>Pago</span>
                <span>{paymentLabel(selected.paymentMethod)}</span>
              </div>
            </section>

            <section>
              <p className="eyebrow">Estado</p>
              <ol className="mt-3 flex items-center gap-2 text-xs">
                {(["pending", "preparing", "sent", "delivered"] as OrderStatus[]).map((s, i) => {
                  const reached =
                    (["pending", "preparing", "sent", "delivered"] as OrderStatus[]).indexOf(
                      selected.status,
                    ) >= i;
                  return (
                    <li key={s} className="flex flex-1 items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${reached ? "bg-primary" : "bg-muted"}`}
                      />
                      <span className={reached ? "text-foreground" : "text-muted-foreground"}>
                        {ORDER_STATUS_LABEL[s]}
                      </span>
                      {i < 3 ? <span className="h-px flex-1 bg-border" /> : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
