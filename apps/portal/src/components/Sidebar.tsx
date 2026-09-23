"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function Sidebar({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <span className="truncate text-[15px] font-semibold tracking-tight">{businessName}</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-sidebar-active text-sidebar-foreground"
                  : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-sidebar-border px-3 py-4">
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-sidebar-muted transition-colors hover:bg-sidebar-active/60 hover:text-sidebar-foreground">
          <SettingsIcon className="h-[18px] w-[18px] shrink-0" />
          Configuración
        </button>
        <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-xs font-medium text-sidebar-foreground">
            A
          </span>
          Administrador
        </div>
      </div>
    </aside>
  );
}

type IconProps = { className?: string };

function icon(paths: ReactNode) {
  return function Icon({ className }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
}

const HomeIcon = icon(
  <path d="M4 11.5 12 4l8 7.5M6 9.5V20h12V9.5" />,
);
const OrdersIcon = icon(
  <>
    <path d="M4 7h16l-1.5 12.5a1 1 0 0 1-1 .9H6.5a1 1 0 0 1-1-.9L4 7Z" />
    <path d="M9 7V6a3 3 0 0 1 6 0v1" />
  </>,
);
const ChatIcon = icon(
  <path d="M4 5h16v11H8l-4 4V5Z" />,
);
const CatalogIcon = icon(
  <>
    <rect x="4" y="4" width="7" height="7" rx="1" />
    <rect x="13" y="4" width="7" height="7" rx="1" />
    <rect x="4" y="13" width="7" height="7" rx="1" />
    <rect x="13" y="13" width="7" height="7" rx="1" />
  </>,
);
const SettingsIcon = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </>,
);

const NAV = [
  { href: "/", label: "Inicio", icon: HomeIcon },
  { href: "/pedidos", label: "Pedidos", icon: OrdersIcon },
  { href: "/conversaciones", label: "Conversaciones", icon: ChatIcon },
  { href: "/catalogo", label: "Catálogo", icon: CatalogIcon },
];
