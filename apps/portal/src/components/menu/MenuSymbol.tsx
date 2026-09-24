import { CakeSlice, CupSoda, Drumstick, Hamburger, Pizza, Star, Utensils, type LucideIcon } from "lucide-react";

import type { MenuSymbolName } from "@/lib/menu";

/**
 * Símbolos de categoría del menú, en vez de emojis: se ven igual en todos los
 * teléfonos y toman el color del texto. Lucide no trae papas ni perro
 * caliente, así que esos dos están dibujados aquí con el mismo trazo.
 */

function Fries(props: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 10V4.5M11 10V3.5M14 10V4.5M17 10V6" />
      <path d="M5.5 10h13l-1.6 10H7.1L5.5 10Z" />
    </svg>
  );
}

function HotDog(props: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="9" width="18" height="7" rx="3.5" />
      <path d="M6.5 12.5c1.8-1 3.7 1 5.5 0s3.7-1 5.5 0" />
    </svg>
  );
}

const ICONS: Record<MenuSymbolName, LucideIcon | typeof Fries> = {
  burger: Hamburger,
  chicken: Drumstick,
  fries: Fries,
  drink: CupSoda,
  dessert: CakeSlice,
  pizza: Pizza,
  hotdog: HotDog,
  star: Star,
  plate: Utensils,
};

export function MenuSymbol({ name, className = "h-5 w-5" }: { name: MenuSymbolName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}
