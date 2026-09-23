"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useInbox } from "@/components/providers/InboxProvider";
import { useOrders } from "@/components/providers/OrdersProvider";
import { DEMO_MODE } from "@/lib/portal-api";

import { ChatIcon, HomeIcon, MenuBookIcon, OrdersIcon } from "./icons";

/**
 * Riel lateral en pantalla grande, barra inferior en el celular. Los mismos
 * cuatro destinos y los mismos contadores: pedidos nuevos sin aceptar y
 * chats que esperan a una persona — las dos cosas que no pueden esperar.
 */

function useNavItems() {
  const { orders } = useOrders();
  const { attentionCount } = useInbox();
  const newOrders = orders.filter((o) => o.status === "pending").length;

  return [
    { href: "/", label: "Inicio", icon: HomeIcon, badge: 0 },
    { href: "/pedidos", label: "Pedidos", icon: OrdersIcon, badge: newOrders },
    { href: "/conversaciones", label: "Conversaciones", short: "Chats", icon: ChatIcon, badge: attentionCount },
    { href: "/menu", label: "Menú", icon: MenuBookIcon, badge: 0 },
  ];
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar({ businessName }: { businessName: string }) {
  const pathname = usePathname();
  const items = useNavItems();

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-rail text-rail-fg lg:flex">
      <div className="flex h-16 items-center gap-3 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand font-display text-lg font-bold text-white">
          {businessName.charAt(0)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-lg font-semibold">{businessName}</p>
          <p className="text-xs text-rail-muted">Portal del restaurante</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] transition-colors ${
                active ? "bg-rail-active text-rail-fg" : "text-rail-muted hover:bg-rail-active/60 hover:text-rail-fg"
              }`}
            >
              {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" /> : null}
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge > 0 ? (
                <span className="min-w-6 rounded-full bg-brand px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-rail-line px-5 py-4 text-sm">
        <p className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-whatsapp" />
          Asistente de WhatsApp activo
        </p>
        {DEMO_MODE ? (
          <p className="rounded-md bg-rail-active px-2.5 py-1.5 text-xs text-rail-muted">
            Modo demostración: los pedidos son de ejemplo.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const items = useNavItems();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="grid h-16 grid-cols-4">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  active ? "text-ink" : "text-ink-3"
                }`}
              >
                <span className="relative">
                  <item.icon className="h-6 w-6" />
                  {item.badge > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 min-w-5 rounded-full border-2 border-surface bg-brand px-1 text-center text-[10px] font-bold leading-4 text-white tabular-nums">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                {item.short ?? item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
