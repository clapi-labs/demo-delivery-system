import type { ReactNode } from "react";

import type { MenuSymbolName } from "@/lib/menu";

/**
 * Símbolos de categoría del menú. Dibujados en el mismo trazo que los íconos
 * del portal (`components/icons.tsx`), en vez de emojis: se ven igual en
 * todos los teléfonos y toman el color del texto.
 */
const PATHS: Record<MenuSymbolName, ReactNode> = {
  burger: (
    <>
      <path d="M4 11a8 6 0 0 1 16 0H4Z" />
      <path d="M3.5 14.5h17" />
      <path d="M4 17.5h16V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-.5Z" />
    </>
  ),
  chicken: (
    <>
      <circle cx="15.5" cy="8.5" r="5" />
      <path d="m12 12-4.3 4.3a1.8 1.8 0 1 0-2.4 2.4 1.8 1.8 0 1 0 2.4-2.4" />
    </>
  ),
  fries: (
    <>
      <path d="M8 10V4.5M11 10V3.5M14 10V4.5M17 10V6" />
      <path d="M5.5 10h13l-1.6 10H7.1L5.5 10Z" />
    </>
  ),
  drink: (
    <>
      <path d="M6 8h12" />
      <path d="M7 8l1.2 12h7.6L17 8" />
      <path d="m12 8 1.5-5H17" />
    </>
  ),
  dessert: (
    <>
      <path d="M6 12a6 5 0 0 1 12 0" />
      <path d="M5.5 12h13l-1.5 8h-10L5.5 12Z" />
      <path d="M12 7V4.5" />
    </>
  ),
  pizza: (
    <>
      <path d="M12 21 4 6.5a15 15 0 0 1 16 0L12 21Z" />
      <circle cx="10" cy="10" r="1" />
      <circle cx="14" cy="11.5" r="1" />
      <circle cx="12" cy="15" r="1" />
    </>
  ),
  hotdog: (
    <>
      <rect x="3" y="9" width="18" height="7" rx="3.5" />
      <path d="M6.5 12.5c1.8-1 3.7 1 5.5 0s3.7-1 5.5 0" />
    </>
  ),
  star: <path d="m12 4 2.4 5 5.3.6-4 3.6 1.2 5.3L12 15.9l-4.9 2.6 1.2-5.3-4-3.6 5.3-.6L12 4Z" />,
  plate: (
    <>
      <path d="M6 3v7a2 2 0 0 0 2 2v9M10 3v7a2 2 0 0 1-2 2M8 3v5" />
      <path d="M18 21V3c-2 0-3.5 2.5-3.5 6s1.5 4 3.5 4" />
    </>
  ),
};

export function MenuSymbol({ name, className = "h-5 w-5" }: { name: MenuSymbolName; className?: string }) {
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
      {PATHS[name]}
    </svg>
  );
}
