"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useInbox } from "@/components/providers/InboxProvider";
import { useOrders } from "@/components/providers/OrdersProvider";
import { DEMO_BOT_STATS } from "@/lib/demo-data";
import { minutesBetween, urgency } from "@/lib/orders";
import { DEMO_MODE } from "@/lib/portal-api";
import { useNow } from "@/lib/use-now";

import { BotIcon, ChatIcon, ChevronDownIcon, HomeIcon, MenuBookIcon, OrdersIcon } from "./icons";

/**
 * Navegación en tres tamaños:
 *
 * - Celular (< md): barra inferior, al alcance del pulgar.
 * - Tablet (md a xl): riel compacto de íconos con etiqueta corta, para no
 *   robarle ancho al tablero de pedidos.
 * - Escritorio (xl+): riel completo con nombres y el widget del asistente.
 *
 * Los mismos contadores en los tres: pedidos nuevos sin aceptar (rojo si
 * alguno ya se demoró) y chats que esperan a una persona (ámbar).
 */

type BadgeTone = "danger" | "brand" | "warn";

const BADGE: Record<BadgeTone, string> = {
  danger: "bg-danger text-white",
  brand: "bg-brand text-white",
  warn: "bg-warn text-zinc-950",
};

function useNavItems() {
  const { orders } = useOrders();
  const { attentionCount } = useInbox();
  const now = useNow();
  const pending = orders.filter((o) => o.status === "pending");
  const late = now !== null && pending.some((o) => urgency("pending", minutesBetween(o.createdAt, now)) === "late");

  return [
    { href: "/", label: "Inicio", short: "Inicio", icon: HomeIcon, badge: 0, tone: "brand" as BadgeTone },
    {
      href: "/pedidos",
      label: "Pedidos",
      short: "Pedidos",
      icon: OrdersIcon,
      badge: pending.length,
      tone: (late ? "danger" : "brand") as BadgeTone,
    },
    {
      href: "/conversaciones",
      label: "Conversaciones",
      short: "Chats",
      icon: ChatIcon,
      badge: attentionCount,
      tone: "warn" as BadgeTone,
    },
    { href: "/menu", label: "Menú", short: "Menú", icon: MenuBookIcon, badge: 0, tone: "brand" as BadgeTone },
  ];
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Badge({ count, tone, className = "" }: { count: number; tone: BadgeTone; className?: string }) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.span
          key="badge"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 30 }}
          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${BADGE[tone]} ${className}`}
        >
          {count}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const { conversations } = useInbox();
  const botChats = conversations.filter((c) => !c.botPaused).length;

  return (
    <>
      {/* Tablet: solo el ícono con su punto de estado. */}
      <div
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800/60 xl:hidden"
        title="Asistente de WhatsApp activo"
      >
        <span className="relative text-whatsapp">
          <BotIcon className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-zinc-800 bg-whatsapp" />
        </span>
        <span className="sr-only">Asistente de WhatsApp activo</span>
      </div>

      {/* Escritorio: el widget completo, plegable. */}
      <div className="hidden rounded-xl bg-zinc-800/60 p-3 text-sm xl:block">
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2.5 text-left">
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-whatsapp/15 text-whatsapp">
            <BotIcon className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-800 bg-whatsapp" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-rail-fg">Asistente activo</span>
            <span className="block truncate text-xs text-rail-muted">WhatsApp conectado</span>
          </span>
          <ChevronDownIcon className={`ease-ui h-4 w-4 shrink-0 text-rail-muted ${open ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <dl className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-rail-muted">Mensajes hoy</dt>
                  <dd className="font-medium tabular-nums text-rail-fg">{DEMO_BOT_STATS.messagesToday}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-rail-muted">Pedidos por chat</dt>
                  <dd className="font-medium tabular-nums text-rail-fg">{DEMO_BOT_STATS.ordersGenerated}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-rail-muted">Chats que atiende</dt>
                  <dd className="font-medium tabular-nums text-rail-fg">{botChats}</dd>
                </div>
              </dl>
              {DEMO_MODE ? (
                <p className="mt-3 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-rail-muted">
                  Modo demostración: los pedidos son de ejemplo.
                </p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}

export function Sidebar({ businessName }: { businessName: string }) {
  const pathname = usePathname();
  const items = useNavItems();

  return (
    <aside className="hidden h-full w-[5.5rem] shrink-0 flex-col bg-rail pt-[env(safe-area-inset-top)] text-rail-fg md:flex xl:w-64">
      <div className="flex h-16 items-center justify-center gap-3 px-5 xl:justify-start">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-base font-bold text-white shadow-sm">
          {businessName.charAt(0)}
        </span>
        <div className="hidden min-w-0 leading-tight xl:block">
          <p className="truncate font-semibold tracking-title">{businessName}</p>
          <p className="text-xs text-rail-muted">Portal del restaurante</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4 xl:px-3">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={`ease-ui relative flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[11px] font-medium xl:flex-row xl:gap-3 xl:px-3 xl:text-sm ${
                active ? "text-rail-fg" : "text-rail-muted hover:bg-white/5 hover:text-rail-fg"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="rail-active"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  className="absolute inset-0 rounded-xl bg-rail-active"
                >
                  <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand" />
                </motion.span>
              ) : null}
              <span className="relative">
                <item.icon className="h-5 w-5 shrink-0" />
                {/* Tablet: el contador va sobre el ícono. */}
                <Badge count={item.badge} tone={item.tone} className="absolute -right-3 -top-2 border-2 border-rail xl:hidden" />
              </span>
              <span className="relative xl:hidden">{item.short}</span>
              <span className="relative hidden flex-1 xl:inline">{item.label}</span>
              <span className="relative hidden xl:block">
                <Badge count={item.badge} tone={item.tone} />
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] xl:p-3">
        <AssistantWidget />
      </div>
    </aside>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const items = useNavItems();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      <ul className="grid h-16 grid-cols-4">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="relative">
              {active ? (
                <motion.span
                  layoutId="tab-active"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-brand"
                />
              ) : null}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`ease-ui flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium active:scale-95 ${
                  active ? "text-ink" : "text-ink-3"
                }`}
              >
                <span className="relative">
                  <item.icon className="h-6 w-6" />
                  <Badge count={item.badge} tone={item.tone} className="absolute -right-3 -top-2 border-2 border-surface" />
                </span>
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
