"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";

import { normalize } from "@sistema/shared";

import { CloseIcon, OrdersIcon, SearchIcon, SwipeIcon } from "@/components/icons";
import { useOrders } from "@/components/providers/OrdersProvider";
import { EmptyState, PageHeader, SearchField, Segmented, Skeleton } from "@/components/ui";
import {
  ACTIVE_STATUSES,
  ORDER_COLUMN_LABEL,
  STATUS_TONE,
  minutesBetween,
  urgency,
  type ActiveStatus,
  type PortalOrder,
} from "@/lib/orders";
import { useNow } from "@/lib/use-now";

import { OrderTicket } from "./OrderTicket";

export type OrdersTab = "all" | ActiveStatus | "delivered";

const EMPTY_TEXT: Record<ActiveStatus, string> = {
  pending: "Sin pedidos nuevos. Cuando un cliente envíe el suyo, aparece aquí solo.",
  preparing: "Nada en la cocina ahora mismo.",
  sent: "Ningún pedido en camino.",
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

const byOldest = (a: PortalOrder, b: PortalOrder) => a.createdAt.localeCompare(b.createdAt);
const byNewest = (a: PortalOrder, b: PortalOrder) => b.createdAt.localeCompare(a.createdAt);

/** Una lista de tarjetas que anima lo que entra y lo que sale. */
function AnimatedList({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div className={className}>
      <AnimatePresence mode="popLayout" initial={false}>
        {children}
      </AnimatePresence>
    </div>
  );
}

function Animated({ id, children }: { id: number; children: ReactNode }) {
  return (
    <motion.div
      key={id}
      layout
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * El tablero de pedidos (RF-28, RF-29).
 *
 * "Todos" es el tablero de la cocina: en pantalla grande tres columnas de
 * izquierda a derecha; en celular y tablet vertical, las mismas tres apiladas,
 * con los más viejos arriba en cada una. Cada estado tiene además su pestaña
 * con contador, y "Entregados" guarda lo cerrado (entregados y cancelados).
 */
export function OrdersBoard({ initialTab = "all", initialQuery = "" }: { initialTab?: OrdersTab; initialQuery?: string }) {
  const { orders, loading, error, freshIds, advance, setStatus } = useOrders();
  const now = useNow();
  // `null` hasta que la persona elige una pestaña: mientras tanto manda la
  // inicial, o "Entregados" si se llegó buscando un pedido ya cerrado.
  const [chosenTab, setTab] = useState<OrdersTab | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [searchOpen, setSearchOpen] = useState(!!initialQuery);
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

  // --- Pestañas que se desplazan -------------------------------------------------

  const tabsRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = () => {
    const el = tabsRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  };

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    // Se recalcula al girar la pantalla y cuando cambian los contadores (que
    // cambian el ancho de las pestañas). El observador avisa también al empezar.
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);

  const tabsMask = `linear-gradient(to right, ${edges.left ? "transparent, black 2.5rem" : "black, black"}, ${
    edges.right ? "black calc(100% - 2.5rem), transparent" : "black"
  })`;

  const dismissHint = () => {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {}
  };

  const q = normalize(query.trim());

  // Si se llegó por "Ver detalle", ese pedido aparece abierto.
  const focusCode = initialQuery.trim().toUpperCase();
  const focusOrder = focusCode ? orders.find((o) => o.code === focusCode) : undefined;
  const focusClosed = focusOrder?.status === "delivered" || focusOrder?.status === "cancelled";
  const tab: OrdersTab = chosenTab ?? (focusClosed ? "delivered" : initialTab);

  // La pestaña elegida (o la que abrió un enlace, p. ej. "Entregados") nunca
  // queda escondida detrás del borde.
  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [tab]);

  const groups = useMemo(() => {
    const visible = orders.filter((o) => matches(o, q));
    const active = visible.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
    return {
      active: [...active].sort(byOldest),
      pending: active.filter((o) => o.status === "pending").sort(byOldest),
      preparing: active.filter((o) => o.status === "preparing").sort(byOldest),
      sent: active.filter((o) => o.status === "sent").sort(byOldest),
      delivered: visible.filter((o) => o.status === "delivered").sort(byNewest),
      cancelled: visible.filter((o) => o.status === "cancelled").sort(byNewest),
    };
  }, [orders, q]);

  const late =
    now !== null && groups.pending.some((o) => urgency("pending", minutesBetween(o.createdAt, now)) === "late");

  const onDrop = (status: ActiveStatus, e: DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData("text/order-id"));
    const order = orders.find((o) => o.id === id);
    if (order && order.status !== status) setStatus(order, status);
  };

  const ticket = (order: PortalOrder) => (
    <Animated key={order.id} id={order.id}>
      <OrderTicket
        order={order}
        now={now}
        fresh={freshIds.has(order.id)}
        defaultExpanded={order.code === focusCode}
        onAdvance={advance}
        onSetStatus={setStatus}
      />
    </Animated>
  );

  const skeletonCards = (n: number) =>
    Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-52 rounded-xl" />);

  return (
    <div className="mx-auto max-w-[88rem] px-4 pb-8 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <PageHeader
        title="Pedidos"
        description={
          error ? (
            <span className="text-danger-ink">Sin conexión con el servidor. Reintentando…</span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
              </span>
              En vivo: se actualiza solo.
            </span>
          )
        }
        actions={
          <>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar pedido, cliente o producto"
              className="hidden w-80 lg:block"
            />
            <button
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar"}
              className="ease-ui rounded-xl bg-surface p-2.5 text-ink-2 shadow-sm ring-1 ring-black/5 lg:hidden"
            >
              {searchOpen ? <CloseIcon /> : <SearchIcon />}
            </button>
          </>
        }
      />

      <AnimatePresence initial={false}>
        {searchOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden lg:hidden"
          >
            <SearchField value={query} onChange={setQuery} placeholder="Buscar pedido, cliente o producto" className="pt-4" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="sticky top-0 z-10 -mx-4 mt-4 bg-canvas/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mt-6 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        {/* En el celular no caben las cinco pestañas: se desplazan de lado, y
            el borde que tiene más pestañas escondidas se desvanece. */}
        <div ref={tabsRef} onScroll={updateEdges} style={{ maskImage: tabsMask, WebkitMaskImage: tabsMask }} className="no-scrollbar overflow-x-auto">
          <Segmented<OrdersTab>
            value={tab}
            onChange={setTab}
            className="w-max min-w-full lg:min-w-0"
            options={[
              { value: "all", label: "Todos", count: groups.active.length },
              { value: "pending", label: "Nuevos", count: groups.pending.length, countTone: late ? "danger" : "brand" },
              { value: "preparing", label: "En preparación", count: groups.preparing.length },
              { value: "sent", label: "Enviados", count: groups.sent.length },
              { value: "delivered", label: "Entregados", count: groups.delivered.length },
            ]}
          />
        </div>
      </div>

      {showHint && tab !== "delivered" ? (
        <div className="card mt-2 flex items-center gap-3 px-3 py-2.5 text-sm text-ink-2 can-hover:hidden">
          <SwipeIcon className="h-5 w-5 shrink-0 text-brand" />
          <p className="flex-1">Desliza un pedido hacia la derecha para pasarlo al siguiente estado.</p>
          <button onClick={dismissHint} aria-label="Entendido" className="ease-ui rounded-full p-1.5 hover:bg-sunken">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="mt-4 lg:mt-5">
        {tab === "all" ? (
          <>
            {/* Celular y tablet vertical: las tres columnas apiladas, en el
                mismo orden que en escritorio (lo que más urge, arriba). En
                tablet, cada sección en dos columnas.

                `grid-cols-1` explícito, no `grid` a secas: la columna
                implícita se dimensiona `auto`, o sea al ancho MÍNIMO de la
                tarjeta más ancha, y se desborda de la pantalla sin avisar.
                `grid-cols-1` es `minmax(0, 1fr)`, que sí obliga a caber. */}
            <div className="lg:hidden">
              {loading ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{skeletonCards(4)}</div>
              ) : groups.active.length === 0 ? (
                <EmptyState icon={<OrdersIcon />} title={q ? "Nada coincide con la búsqueda" : "No hay pedidos en curso"}>
                  Cuando un cliente envíe su pedido desde el menú, aparece aquí solo.
                </EmptyState>
              ) : (
                <div className="space-y-6">
                  {ACTIVE_STATUSES.map((status) => {
                    const list = groups[status];
                    // Buscando, las secciones vacías solo estorban.
                    if (q && list.length === 0) return null;
                    const tone = STATUS_TONE[status];
                    return (
                      <section key={status} aria-label={ORDER_COLUMN_LABEL[status]}>
                        <header className="mb-2.5 flex items-center gap-2 px-1">
                          <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                          <h2 className="text-sm font-semibold tracking-title">{ORDER_COLUMN_LABEL[status]}</h2>
                          <span
                            className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums ${tone.soft} ${tone.ink}`}
                          >
                            {list.length}
                          </span>
                        </header>
                        {list.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-line-strong px-4 py-4 text-center text-sm text-ink-3">
                            {EMPTY_TEXT[status]}
                          </p>
                        ) : (
                          <AnimatedList className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                            {list.map((o) => ticket(o))}
                          </AnimatedList>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Escritorio: tres columnas, se puede arrastrar entre ellas. */}
            <div className="hidden items-start gap-5 lg:grid lg:grid-cols-3">
              {ACTIVE_STATUSES.map((status) => {
                const list = groups[status];
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
                    className={`ease-ui flex min-h-[60vh] flex-col rounded-2xl bg-well/70 p-3 ${
                      dragOver === status ? "bg-well ring-2 ring-brand/40" : ""
                    }`}
                  >
                    <header className="mb-3 flex items-center gap-2 px-1">
                      <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                      <h2 className="text-sm font-semibold tracking-title">{ORDER_COLUMN_LABEL[status]}</h2>
                      <span
                        className={`ml-auto flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums ${tone.soft} ${tone.ink}`}
                      >
                        {list.length}
                      </span>
                    </header>
                    {loading ? (
                      <div className="space-y-3">{skeletonCards(2)}</div>
                    ) : list.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-3">
                        {q ? "Nada coincide con la búsqueda." : EMPTY_TEXT[status]}
                      </p>
                    ) : (
                      <AnimatedList className="flex flex-col gap-3">{list.map((o) => ticket(o))}</AnimatedList>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        ) : tab === "delivered" ? (
          loading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{skeletonCards(3)}</div>
          ) : groups.delivered.length + groups.cancelled.length === 0 ? (
            <EmptyState icon={<OrdersIcon />} title={q ? "Nada coincide con la búsqueda" : "Todavía no hay pedidos entregados"}>
              Aquí quedan los pedidos entregados y los cancelados.
            </EmptyState>
          ) : (
            <div className="space-y-6">
              <AnimatedList className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groups.delivered.map((o) => ticket(o))}
              </AnimatedList>
              {groups.cancelled.length > 0 ? (
                <section>
                  <h2 className="mb-3 text-sm font-semibold text-ink-2">Cancelados ({groups.cancelled.length})</h2>
                  <AnimatedList className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {groups.cancelled.map((o) => ticket(o))}
                  </AnimatedList>
                </section>
              ) : null}
            </div>
          )
        ) : loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{skeletonCards(3)}</div>
        ) : groups[tab].length === 0 ? (
          <EmptyState icon={<OrdersIcon />} title={q ? "Nada coincide con la búsqueda" : EMPTY_TEXT[tab]} />
        ) : (
          <AnimatedList className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groups[tab].map((o) => ticket(o))}
          </AnimatedList>
        )}
      </div>
    </div>
  );
}
