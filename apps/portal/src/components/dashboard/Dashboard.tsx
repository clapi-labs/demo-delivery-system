"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState, type ComponentType, type ReactNode } from "react";

import { formatCOP } from "@sistema/shared";

import {
  BagIcon,
  BikeIcon,
  CancelIcon,
  ChatIcon,
  CheckIcon,
  ChefIcon,
  ChevronRightIcon,
  EyeIcon,
  MenuBookIcon,
  OrdersIcon,
  ReceiptIcon,
  SalesIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@/components/icons";
import { useInbox } from "@/components/providers/InboxProvider";
import { useMenu } from "@/components/providers/MenuProvider";
import { useOrders } from "@/components/providers/OrdersProvider";
import { Skeleton, StatusBadge } from "@/components/ui";
import { conversationName, needsAttention } from "@/lib/inbox";
import {
  ACTIVE_STATUSES,
  ADVANCE_LABEL,
  ORDER_COLUMN_LABEL,
  STATUS_TONE,
  customerLabel,
  elapsedLabel,
  minutesBetween,
  urgency,
  type ActiveStatus,
  type PortalOrder,
} from "@/lib/orders";
import { useNow } from "@/lib/use-now";

export type BusinessHours = { name: string; opensAt: number; closesAt: number; timezone: string };

const dateFormat = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const DAY_MS = 86_400_000;

function hourIn(timezone: string, when: number) {
  return (
    Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(when)) % 24
  );
}

function hourLabel(h: number) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h < 12 ? "a.m." : "p.m."}`;
}

function greeting(hour: number) {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

type Summary = { sales: number; count: number; average: number; cancelled: number };

function summarize(orders: PortalOrder[]): Summary {
  const billable = orders.filter((o) => o.status !== "cancelled");
  const sales = billable.reduce((sum, o) => sum + o.total, 0);
  return {
    sales,
    count: billable.length,
    average: billable.length ? Math.round(sales / billable.length) : 0,
    cancelled: orders.length - billable.length,
  };
}

// --- Alertas -------------------------------------------------------------------

type AlertTone = "danger" | "warn" | "idle" | "ok";

const ALERT_STYLE: Record<AlertTone, { box: string; icon: string }> = {
  danger: { box: "bg-danger-soft ring-danger/15 hover:ring-danger/30", icon: "bg-danger text-white" },
  warn: { box: "bg-warn-soft ring-warn/20 hover:ring-warn/40", icon: "bg-warn text-zinc-950" },
  idle: { box: "bg-surface ring-black/5 hover:ring-black/10", icon: "bg-idle-soft text-idle-ink" },
  ok: { box: "bg-ok-soft ring-ok/15 hover:ring-ok/30", icon: "bg-ok text-white" },
};

function Alert({
  href,
  tone,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  tone: AlertTone;
  icon: ComponentType<{ className?: string }>;
  title: string;
  detail: string;
}) {
  const style = ALERT_STYLE[tone];
  return (
    <Link
      href={href}
      className={`ease-ui group flex h-full min-h-[4.5rem] items-center gap-3 rounded-xl px-4 py-3 shadow-sm ring-1 ${style.box}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.icon}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-sm text-ink-2">{detail}</span>
      </span>
      <ChevronRightIcon className="ease-ui h-5 w-5 shrink-0 text-ink-3 group-hover:translate-x-0.5" />
    </Link>
  );
}

// --- Métricas ------------------------------------------------------------------

function Trend({ today, yesterday, upIsGood = true }: { today: number; yesterday: number; upIsGood?: boolean }) {
  if (yesterday === 0) {
    return <p className="mt-2 text-xs text-ink-3">{today === 0 ? "Igual que ayer" : "Sin datos de ayer"}</p>;
  }
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  if (pct === 0) return <p className="mt-2 text-xs text-ink-3">Igual que ayer a esta hora</p>;
  const good = pct > 0 === upIsGood;
  const Icon = pct > 0 ? TrendUpIcon : TrendDownIcon;
  return (
    <p className={`mt-2 flex items-center gap-1 text-xs font-medium ${good ? "text-ok-ink" : "text-danger-ink"}`}>
      <Icon className="h-3.5 w-3.5" />
      {pct > 0 ? "+" : ""}
      {pct}% <span className="font-normal text-ink-3">vs. ayer</span>
    </p>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  trend: ReactNode;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink-2">{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-3">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-title sm:text-3xl">{value}</p>
      {trend}
    </div>
  );
}

// --- Gráfico -------------------------------------------------------------------

type HourBucket = { hour: number; count: number; sales: number };

/** Pedidos por hora de hoy: una sola serie, columnas finas, detalle al pasar. */
function HourlyChart({ buckets, currentHour }: { buckets: HourBucket[]; currentHour: number | null }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(4, ...buckets.map((b) => b.count));
  const step = max <= 4 ? 1 : max <= 10 ? 2 : 5;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step).reverse();

  return (
    <figure>
      <div className="relative flex h-48 gap-1.5 pl-7 sm:gap-2" onMouseLeave={() => setHovered(null)}>
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {ticks.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className="w-5 text-right text-[11px] tabular-nums text-ink-3">{t}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          ))}
        </div>
        {buckets.map((b, i) => {
          const dimmed = hovered !== null && hovered !== b.hour;
          return (
            <div
              key={b.hour}
              tabIndex={0}
              onMouseEnter={() => setHovered(b.hour)}
              onFocus={() => setHovered(b.hour)}
              onBlur={() => setHovered(null)}
              className="relative flex flex-1 cursor-default items-end justify-center outline-none"
            >
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: i * 0.03, type: "spring", stiffness: 260, damping: 30 }}
                style={{ height: `${(b.count / top) * 100}%`, minHeight: b.count ? 4 : 0, originY: 1 }}
                className={`ease-ui w-full max-w-7 rounded-t-lg ${
                  b.hour === currentHour ? "bg-brand" : "bg-brand/60"
                } ${dimmed ? "opacity-35" : "opacity-100"}`}
              />
              {hovered === b.hour ? (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-50 shadow-lg"
                >
                  <p className="font-semibold">{hourLabel(b.hour)}</p>
                  <p className="mt-0.5 text-zinc-300">
                    {b.count} {b.count === 1 ? "pedido" : "pedidos"} – {formatCOP(b.sales)}
                  </p>
                </motion.div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 pl-7 sm:gap-2" aria-hidden="true">
        {buckets.map(({ hour }, i) => (
          <span
            key={hour}
            className={`flex-1 text-center text-[11px] tabular-nums ${
              hour === currentHour ? "font-semibold text-ink" : "text-ink-3"
            }`}
          >
            {i % 2 === 0 || hour === currentHour ? hourLabel(hour).replace(" ", "") : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Pedidos por hora, hoy</caption>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.hour}>
              <th scope="row">{hourLabel(b.hour)}</th>
              <td>{b.count} pedidos</td>
              <td>{formatCOP(b.sales)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// --- Cocina --------------------------------------------------------------------

const KITCHEN_ICON: Record<ActiveStatus, ComponentType<{ className?: string }>> = {
  pending: OrdersIcon,
  preparing: ChefIcon,
  sent: BikeIcon,
};

function Kitchen({ orders }: { orders: PortalOrder[] }) {
  const counts = ACTIVE_STATUSES.map((s) => ({ status: s, count: orders.filter((o) => o.status === s).length }));
  const total = Math.max(1, counts.reduce((sum, c) => sum + c.count, 0));

  return (
    <div className="grid grid-cols-3 gap-3">
      {counts.map(({ status, count }) => {
        const tone = STATUS_TONE[status];
        const Icon = KITCHEN_ICON[status];
        return (
          <Link
            key={status}
            href={`/pedidos?estado=${status}`}
            className="card ease-ui group p-3.5 hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tone.soft} ${tone.ink}`}>
              <Icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-title">{count}</p>
            <p className="truncate text-xs text-ink-2">{ORDER_COLUMN_LABEL[status]}</p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sunken">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(count / total) * 100}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 30 }}
                className={`h-full rounded-full ${tone.dot}`}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// --- Página --------------------------------------------------------------------

export function Dashboard({ business }: { business: BusinessHours }) {
  const { orders, loading, advance } = useOrders();
  const { conversations } = useInbox();
  const { products } = useMenu();
  const now = useNow();

  const hour = now ? hourIn(business.timezone, now) : null;
  const open = hour !== null && hour >= business.opensAt && hour < business.closesAt;

  // Hoy hasta ahora, contra ayer hasta la misma hora.
  const startToday = now ? new Date(now).setHours(0, 0, 0, 0) : 0;
  const inRange = (o: PortalOrder, from: number, to: number) => {
    const t = new Date(o.createdAt).getTime();
    return t >= from && t < to;
  };
  const todayOrders = now ? orders.filter((o) => inRange(o, startToday, now + 60_000)) : [];
  const yesterdayOrders = now ? orders.filter((o) => inRange(o, startToday - DAY_MS, now - DAY_MS)) : [];
  const today = summarize(todayOrders);
  const yesterday = summarize(yesterdayOrders);

  const pending = orders
    .filter((o) => o.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const oldestWait = now && pending[0] ? minutesBetween(pending[0].createdAt, now) : 0;
  const ordersLate = now !== null && urgency("pending", oldestWait) === "late";
  const waiting = conversations.filter(needsAttention);
  const soldOut = products.filter((p) => !p.available);

  const hours = Array.from({ length: Math.max(1, business.closesAt - business.opensAt) }, (_, i) => business.opensAt + i);
  const buckets: HourBucket[] = hours.map((h) => {
    const inHour = todayOrders.filter(
      (o) => o.status !== "cancelled" && hourIn(business.timezone, new Date(o.createdAt).getTime()) === h,
    );
    return { hour: h, count: inHour.length, sales: inHour.reduce((sum, o) => sum + o.total, 0) };
  });

  const recent = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const ready = !loading && now !== null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-title sm:text-[1.75rem]">
            {hour !== null ? greeting(hour) : "Hola"}
          </h1>
          <p className="mt-1 text-sm capitalize text-ink-2">{now ? dateFormat.format(now) : " "}</p>
        </div>
        {hour !== null ? (
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium shadow-sm ring-1 ${
              open ? "bg-ok-soft text-ok-ink ring-ok/20" : "bg-surface text-idle-ink ring-black/5"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${open ? "bg-ok" : "bg-idle"}`} />
            {open ? `Abierto hasta las ${hourLabel(business.closesAt)}` : `Cerrado. Abre a las ${hourLabel(business.opensAt)}`}
          </span>
        ) : null}
      </header>

      <section aria-label="Lo que necesita atención" className="grid gap-3 md:grid-cols-3">
        {!ready ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[4.5rem] rounded-xl" />)
        ) : (
          <>
            {pending.length > 0 ? (
              <Alert
                href="/pedidos?estado=pending"
                tone={ordersLate ? "danger" : "warn"}
                icon={OrdersIcon}
                title={`${pending.length} ${pending.length === 1 ? "pedido sin aceptar" : "pedidos sin aceptar"}`}
                detail={oldestWait ? `El más antiguo lleva ${elapsedLabel(oldestWait)}` : "Acaba de entrar"}
              />
            ) : (
              <Alert href="/pedidos" tone="ok" icon={CheckIcon} title="Pedidos al día" detail="Nada esperando a la cocina" />
            )}
            {waiting.length > 0 ? (
              <Alert
                href={`/conversaciones?tel=${waiting[0].phone}`}
                tone="warn"
                icon={ChatIcon}
                title={`${waiting.length} ${waiting.length === 1 ? "cliente espera" : "clientes esperan"} atención`}
                detail={`${conversationName(waiting[0])}: ${waiting[0].escalationReason}`}
              />
            ) : (
              <Alert href="/conversaciones" tone="ok" icon={ChatIcon} title="Chats al día" detail="El bot está atendiendo" />
            )}
            <Alert
              href="/menu"
              tone="idle"
              icon={MenuBookIcon}
              title={
                soldOut.length
                  ? `${soldOut.length} ${soldOut.length === 1 ? "producto agotado" : "productos agotados"}`
                  : "Todo el menú disponible"
              }
              detail={soldOut.length ? soldOut.map((p) => p.name).join(", ") : `${products.length} productos a la venta`}
            />
          </>
        )}
      </section>

      <section aria-label="Cifras de hoy" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!ready ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[7.5rem] rounded-xl" />)
        ) : (
          <>
            <Kpi label="Ventas de hoy" value={formatCOP(today.sales)} icon={SalesIcon} trend={<Trend today={today.sales} yesterday={yesterday.sales} />} />
            <Kpi label="Pedidos" value={String(today.count)} icon={BagIcon} trend={<Trend today={today.count} yesterday={yesterday.count} />} />
            <Kpi
              label="Ticket promedio"
              value={formatCOP(today.average)}
              icon={ReceiptIcon}
              trend={<Trend today={today.average} yesterday={yesterday.average} />}
            />
            <Kpi
              label="Cancelados"
              value={String(today.cancelled)}
              icon={CancelIcon}
              trend={<Trend today={today.cancelled} yesterday={yesterday.cancelled} upIsGood={false} />}
            />
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-4 sm:p-5 lg:col-span-3" aria-labelledby="chart-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="chart-title" className="font-semibold tracking-title">
              Pedidos por hora
            </h2>
            <span className="text-xs text-ink-3">Hoy</span>
          </div>
          <div className="mt-4">
            {!ready ? <Skeleton className="h-52" /> : <HourlyChart buckets={buckets} currentHour={hour} />}
          </div>
        </section>

        <section className="lg:col-span-2" aria-labelledby="kitchen-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="kitchen-title" className="font-semibold tracking-title">
              En la cocina ahora
            </h2>
            <Link href="/pedidos" className="ease-ui text-sm font-medium text-brand-ink hover:underline">
              Ir a pedidos
            </Link>
          </div>
          <div className="mt-3">
            {!ready ? (
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : (
              <Kitchen orders={orders} />
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="recent-title">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="recent-title" className="font-semibold tracking-title">
            Últimos pedidos
          </h2>
          <Link href="/pedidos?estado=all" className="ease-ui text-sm font-medium text-brand-ink hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="card mt-3 overflow-hidden">
          {!ready ? (
            <div className="divide-y divide-line">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-ink-2">
              Todavía no hay pedidos. Cuando un cliente envíe el suyo desde el menú, aparece aquí solo.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((o) => (
                <li key={o.id} className="ease-ui group relative flex items-center gap-3 px-4 py-3 hover:bg-sunken/70">
                  <span className="w-[4.5rem] shrink-0 font-mono text-sm font-medium">{o.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{customerLabel(o)}</span>
                    <span className="block truncate text-xs text-ink-2">
                      {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                    </span>
                  </span>
                  <span className="hidden text-sm tabular-nums sm:block">{formatCOP(o.total)}</span>
                  <span className="hidden w-16 text-right text-xs text-ink-3 md:block">
                    {now ? elapsedLabel(minutesBetween(o.createdAt, now)) : ""}
                  </span>
                  <StatusBadge status={o.status} />
                  {/* Acciones rápidas: siempre en el celular, al pasar el cursor en escritorio. */}
                  <span className="ease-ui flex shrink-0 items-center gap-1 lg:pointer-events-none lg:absolute lg:right-3 lg:rounded-lg lg:bg-surface lg:p-1 lg:opacity-0 lg:shadow-md lg:ring-1 lg:ring-black/5 lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100">
                    {o.status === "pending" ? (
                      <button
                        onClick={() => advance(o)}
                        className="ease-ui rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
                      >
                        Aceptar
                      </button>
                    ) : o.status === "preparing" || o.status === "sent" ? (
                      <button
                        onClick={() => advance(o)}
                        className="ease-ui hidden rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 lg:block"
                      >
                        {ADVANCE_LABEL[o.status]}
                      </button>
                    ) : null}
                    <Link
                      href={`/pedidos?pedido=${o.code}`}
                      aria-label={`Ver detalle de ${o.code}`}
                      className="ease-ui flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-ink-2 hover:bg-sunken hover:text-ink"
                    >
                      <EyeIcon className="h-4 w-4" />
                      <span className="hidden lg:inline">Ver detalle</span>
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
