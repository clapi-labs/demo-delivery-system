"use client";

import { useMemo, useState } from "react";

import { formatCOP, formatPhone } from "@sistema/shared";

import { Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import {
  DEMO_ORDERS,
  ORDER_STATUS_ACTION_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  nextOrderStatus,
  orderSubtotal,
  orderTotal,
  relativeTime,
  type DemoOrder,
  type OrderStatus,
} from "@/lib/demo-data";

const TABS: { label: string; status: OrderStatus | "all" }[] = [
  { label: "Todos", status: "all" },
  { label: "Nuevos", status: "pending" },
  { label: "En preparación", status: "preparing" },
  { label: "Enviados", status: "sent" },
  { label: "Entregados", status: "delivered" },
];

function itemsSummary(order: DemoOrder) {
  return order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
}

export default function PedidosPage() {
  const [orders, setOrders] = useState(DEMO_ORDERS);
  const [tab, setTab] = useState<OrderStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => tab === "all" || o.status === tab)
      .filter((o) => !q || o.code.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q))
      .sort((a, b) => a.minutesAgo - b.minutesAgo);
  }, [orders, tab, query]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  const advance = (id: number) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const next = nextOrderStatus(o.status);
        return next ? { ...o, status: next } : o;
      }),
    );
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
          placeholder="Buscar por pedido o cliente…"
          className="mb-2 h-9 w-64 rounded-md border border-border bg-surface px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      <ul className="mt-2 divide-y divide-border">
        {filtered.length === 0 ? (
          <li className="py-10 text-center text-sm text-muted-foreground">
            No hay pedidos que coincidan.
          </li>
        ) : (
          filtered.map((order) => (
            <li key={order.id} className="grid grid-cols-12 items-center gap-4 py-4">
              <div className="col-span-3">
                <p className="font-semibold">{order.code}</p>
                <p className="text-sm text-muted-foreground">{order.customerName}</p>
              </div>
              <div className="col-span-4 text-sm text-muted-foreground">{itemsSummary(order)}</div>
              <div className="col-span-1 text-sm font-medium tabular-nums">
                {formatCOP(orderTotal(order))}
              </div>
              <div className="col-span-2 text-sm text-muted-foreground">
                {PAYMENT_METHOD_LABEL[order.paymentMethod]}
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
        subtitle={selected ? relativeTime(selected.minutesAgo) : undefined}
        footer={
          selected ? (
            <div className="flex items-center justify-between gap-3">
              <StatusBadge status={selected.status} />
              {nextOrderStatus(selected.status) ? (
                <button
                  onClick={() => advance(selected.id)}
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
                  <dd className="font-medium">{selected.customerName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Teléfono</dt>
                  <dd>{formatPhone(selected.phone)}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="shrink-0 text-muted-foreground">Dirección</dt>
                  <dd className="text-right">{selected.address}</dd>
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
                  {selected.items.map((item) => (
                    <tr key={item.name} className="border-b border-border last:border-0">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-center tabular-nums">{item.quantity}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCOP(item.unitPrice * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCOP(orderSubtotal(selected))}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Domicilio</span>
                <span className="tabular-nums">{formatCOP(selected.deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCOP(orderTotal(selected))}</span>
              </div>
              <div className="flex justify-between pt-1 text-muted-foreground">
                <span>Pago</span>
                <span>{PAYMENT_METHOD_LABEL[selected.paymentMethod]}</span>
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
