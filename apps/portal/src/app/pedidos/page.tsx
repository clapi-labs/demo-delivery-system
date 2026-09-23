"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";

import { normalize } from "@sistema/shared";

import { CloseIcon, SearchIcon, SwipeIcon } from "@/components/icons";
import { OrderTicket } from "@/components/orders/OrderTicket";
import { useOrders } from "@/components/providers/OrdersProvider";
import { EmptyState, PageHeader, SearchField, Segmented } from "@/components/ui";
import {
  ACTIVE_STATUSES,
  ORDER_COLUMN_LABEL,
  STATUS_TONE,
  type ActiveStatus,
  type PortalOrder,
} from "@/lib/orders";
import { useNow } from "@/lib/use-now";

type Tab = ActiveStatus | "history";

const EMPTY_COLUMN: Record<ActiveStatus, string> = {
  pending: "Sin pedidos nuevos. Cuando un cliente envíe el suyo, aparece aquí solo.",
  preparing: "Nada en la cocina ahora mismo.",
  sent: "Ningún pedido en camino.",
};

/** En el celular caben cuatro contadores de ancho si los nombres son cortos. */
const SHORT_LABEL: Record<ActiveStatus, string> = {
  pending: "Nuevos",
  preparing: "Preparando",
  sent: "Enviados",
};

const HINT_KEY = "portal:swipe-hint-dismissed";

function matches(order: PortalOrder, q: string) {
  if (!q) return true;
  return (
    normalize(order.code).includes(q) ||
    normalize(order.customerName ?? "").includes(q) ||
    (order.phone ?? "").includes(q) ||
    order.items.some((i) => normalize(i.name).includes(q))
  );
}

/**
 * El tablero de pedidos (RF-28, RF-29).
 *
 * En pantalla grande: tres columnas, de izquierda a derecha el camino del
 * pedido. En el celular: una columna a la vez, elegida con los contadores de
 * arriba, y cada pedido se avanza deslizándolo o con su botón.
 */
export default function PedidosPage() {
  const { orders, loading, error, freshIds, advance, setStatus } = useOrders();
  const now = useNow();
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [dragOver, setDragOver] = useState<ActiveStatus | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    // localStorage solo existe en el navegador; leerlo al montar evita que el
    // servidor y el cliente pinten cosas distintas.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowHint(localStorage.getItem(HINT_KEY) !== "1");
    } catch {
      setShowHint(true);
    }
  }, []);

  const dismissHint = () => {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {}
  };

  const q = normalize(query.trim());

  const columns = useMemo(() => {
    const byStatus = {} as Record<ActiveStatus, PortalOrder[]>;
    for (const status of ACTIVE_STATUSES) {
      // Los más viejos primero: la cocina despacha en orden de llegada.
      byStatus[status] = orders
        .filter((o) => o.status === status && matches(o, q))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return byStatus;
  }, [orders, q]);

  const history = useMemo(
    () =>
      orders
        .filter((o) => (o.status === "delivered" || o.status === "cancelled") && matches(o, q))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders, q],
  );

  const onDrop = (status: ActiveStatus, e: DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData("text/order-id"));
    const order = orders.find((o) => o.id === id);
    if (order && order.status !== status) setStatus(order, status);
  };

  const showingHistory = tab === "history";

  return (
    <div className="mx-auto max-w-[88rem] px-4 pb-8 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <PageHeader
        title="Pedidos"
        description={
          error ? (
            <span className="text-danger">Sin conexión con el servidor. Reintentando…</span>
          ) : (
            "Se actualiza solo cada pocos segundos."
          )
        }
        actions={
          <>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar pedido, cliente o producto"
              className="hidden w-72 lg:block"
            />
            <button
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar"}
              className="rounded-lg border border-line bg-surface p-2.5 text-ink-2 lg:hidden"
            >
              {searchOpen ? <CloseIcon /> : <SearchIcon />}
            </button>
            <Segmented
              value={showingHistory ? "history" : "active"}
              onChange={(v) => setTab(v === "history" ? "history" : "pending")}
              options={[
                { value: "active", label: "En curso" },
                { value: "history", label: "Historial" },
              ]}
              className="hidden lg:flex"
            />
          </>
        }
      />

      {searchOpen ? (
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Buscar pedido, cliente o producto"
          className="mt-4 lg:hidden"
        />
      ) : null}

      {/* Celular: los contadores son también las pestañas. */}
      <div className="sticky top-0 z-10 -mx-4 mt-4 bg-canvas/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
        <div className="grid grid-cols-4 gap-2" role="tablist">
          {ACTIVE_STATUSES.map((status) => {
            const active = tab === status;
            return (
              <button
                key={status}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(status)}
                className={`relative overflow-hidden rounded-lg border px-2 pb-2 pt-2.5 text-left transition-colors ${
                  active ? "border-ink bg-surface" : "border-line bg-surface/60"
                }`}
              >
                <span className={`absolute inset-x-0 top-0 h-1 ${STATUS_TONE[status].dot}`} />
                <span className="block font-display text-2xl font-semibold leading-none tabular-nums">
                  {columns[status].length}
                </span>
                <span className={`mt-1 block truncate text-xs ${active ? "font-semibold" : "text-ink-2"}`}>
                  {SHORT_LABEL[status]}
                </span>
              </button>
            );
          })}
          <button
            role="tab"
            aria-selected={showingHistory}
            onClick={() => setTab("history")}
            className={`rounded-lg border px-2 pb-2 pt-2.5 text-left transition-colors ${
              showingHistory ? "border-ink bg-surface" : "border-line bg-surface/60"
            }`}
          >
            <span className="block font-display text-2xl font-semibold leading-none tabular-nums">
              {history.length}
            </span>
            <span className={`mt-1 block truncate text-xs ${showingHistory ? "font-semibold" : "text-ink-2"}`}>
              Historial
            </span>
          </button>
        </div>
      </div>

      {showHint && !showingHistory ? (
        <div className="mt-2 flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5 text-sm text-ink-2 ring-1 ring-line lg:hidden">
          <SwipeIcon className="h-5 w-5 shrink-0 text-ink" />
          <p className="flex-1">Desliza un pedido hacia la derecha para pasarlo al siguiente estado.</p>
          <button onClick={dismissHint} aria-label="Entendido" className="rounded-md p-1.5 hover:bg-sunken">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-56 animate-pulse rounded-lg bg-sunken ${i > 0 ? "hidden lg:block" : ""}`} />
          ))}
        </div>
      ) : showingHistory ? (
        <section className="mt-4 lg:mt-6">
          {history.length === 0 ? (
            <EmptyState title={q ? "Nada coincide con la búsqueda" : "Todavía no hay pedidos cerrados"}>
              Aquí quedan los pedidos entregados y cancelados.
            </EmptyState>
          ) : (
            <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
              {history.map((order) => (
                <OrderTicket key={order.id} order={order} now={now} onAdvance={advance} onSetStatus={setStatus} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="mt-4 grid items-start gap-5 lg:mt-6 lg:grid-cols-3">
          {ACTIVE_STATUSES.map((status) => {
            const list = columns[status];
            const tone = STATUS_TONE[status];
            return (
              <section
                key={status}
                aria-label={ORDER_COLUMN_LABEL[status]}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                }}
                onDrop={(e) => onDrop(status, e)}
                className={`${tab === status ? "flex" : "hidden lg:flex"} min-h-[50vh] flex-col rounded-xl transition-colors lg:bg-sunken/70 lg:p-3 ${
                  dragOver === status ? "lg:bg-sunken lg:ring-2 lg:ring-line-strong" : ""
                }`}
              >
                <header className="mb-3 hidden items-center gap-2 px-1 lg:flex">
                  <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                  <h2 className="font-display text-xl font-semibold">{ORDER_COLUMN_LABEL[status]}</h2>
                  <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-sm font-semibold tabular-nums text-ink-2 ring-1 ring-line">
                    {list.length}
                  </span>
                </header>

                <div className="flex flex-col gap-3">
                  {list.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-2">
                      {q ? "Nada coincide con la búsqueda." : EMPTY_COLUMN[status]}
                    </p>
                  ) : (
                    list.map((order) => (
                      <OrderTicket
                        key={order.id}
                        order={order}
                        now={now}
                        fresh={freshIds.has(order.id)}
                        onAdvance={advance}
                        onSetStatus={setStatus}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
