"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { formatCOP } from "@sistema/shared";

import { BotIcon, ChatIcon, ChevronRightIcon, MenuBookIcon, OrdersIcon } from "@/components/icons";
import { useInbox } from "@/components/providers/InboxProvider";
import { useMenu } from "@/components/providers/MenuProvider";
import { useOrders } from "@/components/providers/OrdersProvider";
import { StatusBadge } from "@/components/ui";
import { DEMO_BOT_STATS } from "@/lib/demo-data";
import { conversationName, needsAttention } from "@/lib/inbox";
import {
  ACTIVE_STATUSES,
  ORDER_COLUMN_LABEL,
  STATUS_TONE,
  customerLabel,
  elapsedLabel,
  minutesBetween,
} from "@/lib/orders";
import { useNow } from "@/lib/use-now";

export type BusinessHours = { name: string; opensAt: number; closesAt: number; timezone: string };

const dateFormat = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });

function hourIn(timezone: string, now: number) {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(now),
  ) % 24;
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

function AttentionRow({
  href,
  icon,
  tone,
  children,
}: {
  href: string;
  icon: ReactNode;
  tone: "urgent" | "calm";
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-lg px-4 py-3.5 ring-1 transition-colors ${
        tone === "urgent" ? "bg-brand-soft ring-brand/25 hover:ring-brand/50" : "bg-surface ring-line hover:ring-line-strong"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          tone === "urgent" ? "bg-brand text-white" : "bg-sunken text-ink-2"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm">{children}</span>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Pedidos por hora del día: una sola serie, columnas finas. */
function HourlyChart({ counts, currentHour }: { counts: { hour: number; count: number }[]; currentHour: number | null }) {
  const max = Math.max(4, ...counts.map((c) => c.count));
  // Marcas del eje en números redondos.
  const step = max <= 4 ? 1 : max <= 10 ? 2 : 5;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step).reverse();

  return (
    <figure>
      <div className="relative flex h-44 gap-2 pl-7">
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex flex-col justify-between">
          {ticks.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className="w-5 text-right text-[11px] tabular-nums text-ink-3">{t}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          ))}
        </div>
        {counts.map(({ hour, count }) => (
          <div key={hour} className="group relative flex flex-1 items-end justify-center" tabIndex={0}>
            <div
              className={`w-full max-w-6 rounded-t-[4px] transition-opacity ${
                hour === currentHour ? "bg-brand" : "bg-brand/55"
              } group-hover:opacity-80`}
              style={{ height: `${(count / top) * 100}%`, minHeight: count ? 3 : 0 }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-surface group-hover:block group-focus:block">
              {hourLabel(hour)}: {count} {count === 1 ? "pedido" : "pedidos"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 pl-7" aria-hidden="true">
        {counts.map(({ hour }, i) => (
          <span
            key={hour}
            className={`flex-1 text-center text-[11px] tabular-nums ${hour === currentHour ? "font-semibold text-ink" : "text-ink-3"}`}
          >
            {i % 2 === 0 || hour === currentHour ? hourLabel(hour).replace(" ", "") : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Pedidos por hora, hoy</caption>
        <tbody>
          {counts.map(({ hour, count }) => (
            <tr key={hour}>
              <th scope="row">{hourLabel(hour)}</th>
              <td>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function Dashboard({ business }: { business: BusinessHours }) {
  const { orders, loading } = useOrders();
  const { conversations } = useInbox();
  const { products } = useMenu();
  const now = useNow();

  const hour = now ? hourIn(business.timezone, now) : null;
  const open = hour !== null && hour >= business.opensAt && hour < business.closesAt;

  const startOfDay = now ? new Date(new Date(now).setHours(0, 0, 0, 0)) : null;
  const today = startOfDay ? orders.filter((o) => new Date(o.createdAt) >= startOfDay) : [];
  const billable = today.filter((o) => o.status !== "cancelled");
  const sales = billable.reduce((sum, o) => sum + o.total, 0);
  const average = billable.length ? Math.round(sales / billable.length) : 0;

  const pending = orders
    .filter((o) => o.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const oldestWait = now && pending[0] ? minutesBetween(pending[0].createdAt, now) : 0;
  const waiting = conversations.filter(needsAttention);
  const soldOut = products.filter((p) => !p.available);
  const botChats = conversations.filter((c) => !c.botPaused).length;

  const hours = Array.from({ length: Math.max(1, business.closesAt - business.opensAt) }, (_, i) => business.opensAt + i);
  const counts = hours.map((h) => ({
    hour: h,
    count: today.filter((o) => hourIn(business.timezone, new Date(o.createdAt).getTime()) === h).length,
  }));

  const recent = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[2rem] font-semibold leading-none tracking-tight">
            {hour !== null ? greeting(hour) : "Hola"}
          </h1>
          <p className="mt-1.5 text-sm capitalize text-ink-2">{now ? dateFormat.format(now) : " "}</p>
        </div>
        {hour !== null ? (
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
              open ? "bg-st-done-soft text-st-done-ink ring-st-done/30" : "bg-surface text-ink-2 ring-line"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${open ? "bg-st-done" : "bg-st-off"}`} />
            {open ? `Abierto hasta las ${hourLabel(business.closesAt)}` : `Cerrado. Abre a las ${hourLabel(business.opensAt)}`}
          </span>
        ) : null}
      </header>

      <section aria-label="Lo que necesita atención" className="mt-6 grid gap-2.5 md:grid-cols-3">
        {pending.length > 0 ? (
          <AttentionRow href="/pedidos" tone="urgent" icon={<OrdersIcon />}>
            <span className="block font-semibold">
              {pending.length} {pending.length === 1 ? "pedido nuevo" : "pedidos nuevos"} sin aceptar
            </span>
            <span className="text-ink-2">
              {oldestWait ? `El más antiguo lleva ${elapsedLabel(oldestWait)}` : "Acaba de entrar"}
            </span>
          </AttentionRow>
        ) : (
          <AttentionRow href="/pedidos" tone="calm" icon={<OrdersIcon />}>
            <span className="block font-semibold">Pedidos al día</span>
            <span className="text-ink-2">Ningún pedido nuevo esperando</span>
          </AttentionRow>
        )}
        {waiting.length > 0 ? (
          <AttentionRow href={`/conversaciones?tel=${waiting[0].phone}`} tone="urgent" icon={<ChatIcon />}>
            <span className="block font-semibold">
              {waiting.length} {waiting.length === 1 ? "cliente espera" : "clientes esperan"} a una persona
            </span>
            <span className="line-clamp-1 text-ink-2">{conversationName(waiting[0])}: {waiting[0].escalationReason}</span>
          </AttentionRow>
        ) : (
          <AttentionRow href="/conversaciones" tone="calm" icon={<ChatIcon />}>
            <span className="block font-semibold">Chats al día</span>
            <span className="text-ink-2">El bot atiende {botChats} conversaciones</span>
          </AttentionRow>
        )}
        <AttentionRow href="/menu" tone="calm" icon={<MenuBookIcon />}>
          <span className="block font-semibold">
            {soldOut.length ? `${soldOut.length} ${soldOut.length === 1 ? "producto agotado" : "productos agotados"}` : "Todo el menú disponible"}
          </span>
          <span className="line-clamp-1 text-ink-2">
            {soldOut.length ? soldOut.map((p) => p.name).join(", ") : `${products.length} productos a la venta`}
          </span>
        </AttentionRow>
      </section>

      <section aria-label="Cifras de hoy" className="mt-8">
        <h2 className="font-display text-xl font-semibold">Hoy</h2>
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line ring-1 ring-line lg:grid-cols-4">
          {[
            { label: "Ventas", value: formatCOP(sales), hero: true },
            { label: "Pedidos", value: String(billable.length) },
            { label: "Ticket promedio", value: formatCOP(average) },
            { label: "Cancelados", value: String(today.length - billable.length) },
          ].map((stat) => (
            <div key={stat.label} className={`bg-surface px-4 py-4 ${stat.hero ? "col-span-2 lg:col-span-1" : ""}`}>
              <dt className="text-sm text-ink-2">{stat.label}</dt>
              <dd
                className={`mt-1 font-display font-semibold leading-none ${stat.hero ? "text-5xl" : "text-3xl"} ${
                  loading ? "text-ink-3" : ""
                }`}
              >
                {loading ? "—" : stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-labelledby="chart-title">
          <h2 id="chart-title" className="font-display text-xl font-semibold">
            Pedidos por hora
          </h2>
          <div className="mt-3 rounded-lg bg-surface p-4 ring-1 ring-line">
            <HourlyChart counts={counts} currentHour={hour} />
          </div>
        </section>

        <section className="lg:col-span-2" aria-labelledby="kitchen-title">
          <h2 id="kitchen-title" className="font-display text-xl font-semibold">
            En la cocina ahora
          </h2>
          <ul className="mt-3 divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
            {ACTIVE_STATUSES.map((s) => {
              const count = orders.filter((o) => o.status === s).length;
              return (
                <li key={s}>
                  <Link href="/pedidos" className="flex items-center gap-3 px-4 py-3 hover:bg-sunken/60">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_TONE[s].dot}`} />
                    <span className="flex-1">{ORDER_COLUMN_LABEL[s]}</span>
                    <span className="font-display text-2xl font-semibold leading-none">{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface px-4 py-3 ring-1 ring-line">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-whatsapp-soft text-whatsapp-ink">
              <BotIcon />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">Asistente de WhatsApp activo</p>
              <p className="text-ink-2">
                {DEMO_BOT_STATS.messagesToday} mensajes y {DEMO_BOT_STATS.ordersGenerated} pedidos por chat hoy
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-8" aria-labelledby="recent-title">
        <div className="flex items-center justify-between">
          <h2 id="recent-title" className="font-display text-xl font-semibold">
            Últimos pedidos
          </h2>
          <Link href="/pedidos" className="text-sm font-medium text-brand-ink hover:underline">
            Ver todos
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-line-strong px-6 py-10 text-center text-sm text-ink-2">
            {loading ? "Cargando…" : "Todavía no hay pedidos. Cuando un cliente envíe el suyo desde el menú, aparece aquí solo."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
            {recent.map((o) => (
              <li key={o.id}>
                <Link href="/pedidos" className="flex items-center gap-3 px-4 py-3 hover:bg-sunken/60">
                  <span className="w-20 shrink-0 font-display text-lg font-semibold">{o.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{customerLabel(o)}</span>
                    <span className="block truncate text-xs text-ink-2">
                      {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                    </span>
                  </span>
                  <span className="hidden text-sm tabular-nums sm:block">{formatCOP(o.total)}</span>
                  <StatusBadge status={o.status} />
                  <span className="hidden w-16 text-right text-xs text-ink-3 md:block">
                    {now ? elapsedLabel(minutesBetween(o.createdAt, now)) : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
