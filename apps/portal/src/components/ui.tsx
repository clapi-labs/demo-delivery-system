"use client";

import { motion } from "motion/react";
import { useId, type ReactNode } from "react";

import { ORDER_STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/lib/orders";

import { SearchIcon } from "./icons";

/** Piezas pequeñas que se repiten en todas las pantallas. */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-title sm:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Pastilla de estado del pedido: color vivo + punto + texto. */
export function StatusBadge({ status, size = "sm" }: { status: OrderStatus; size?: "sm" | "md" }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium ${tone.soft} ${tone.ink} ${
        size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

type Tone = "danger" | "warn" | "ok" | "idle" | "brand";

const TONE_CLASS: Record<Tone, string> = {
  danger: "bg-danger-soft text-danger-ink",
  warn: "bg-warn-soft text-warn-ink",
  ok: "bg-ok-soft text-ok-ink",
  idle: "bg-idle-soft text-idle-ink",
  brand: "bg-brand-soft text-brand-ink",
};

export function Pill({ tone, children, className = "" }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Nombre accesible; si no se ve texto al lado, es obligatorio. */
  label: string;
  size?: "sm" | "md";
}) {
  const track = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`ease-ui relative inline-flex shrink-0 items-center rounded-full p-0.5 after:absolute after:-inset-2.5 after:content-[''] ${track} ${
        checked ? "justify-end bg-ok" : "justify-start bg-line-strong"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 35 }}
        className={`rounded-full bg-white shadow-sm ${knob}`}
      />
    </button>
  );
}

/** Pestañas: la pastilla blanca se desliza a la opción elegida. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = "",
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; count?: number; countTone?: Tone }[];
  className?: string;
  size?: "md" | "sm";
}) {
  const id = useId();
  return (
    <div role="tablist" className={`flex gap-1 rounded-xl bg-well/80 p-1 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`ease-ui relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium ${
              size === "sm" ? "px-2.5 py-1 text-[13px]" : "px-3 py-1.5 text-sm"
            } ${active ? "text-ink" : "text-ink-2 hover:text-ink"}`}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-lg bg-surface shadow-sm ring-1 ring-black/5"
              />
            ) : null}
            <span className="relative flex items-center gap-1.5">
              {o.label}
              {o.count !== undefined ? (
                <span
                  className={`min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums ${
                    o.countTone && o.count > 0 ? TONE_CLASS[o.countTone] : active ? "bg-ink text-surface" : "bg-line text-ink-2"
                  }`}
                >
                  {o.count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">{placeholder}</span>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
        <SearchIcon className="h-4 w-4" />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ease-ui h-11 w-full rounded-xl bg-surface pl-9 pr-3 text-base shadow-sm can-hover:h-10 can-hover:text-sm outline-none ring-1 ring-black/5 placeholder:text-ink-3 focus:ring-2 focus:ring-brand/40"
      />
    </label>
  );
}

/** Un campo de formulario con su etiqueta encima. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "ease-ui h-11 w-full rounded-lg border border-line bg-surface px-3 text-base outline-none placeholder:text-ink-3 focus:border-brand focus:ring-2 focus:ring-brand/20 can-hover:h-10 can-hover:text-sm";

export const buttonPrimary =
  "ease-ui inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 can-hover:h-10";

export const buttonBrand =
  "ease-ui inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white shadow-sm hover:brightness-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 can-hover:h-10";

export const buttonSecondary =
  "ease-ui inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-surface px-4 text-sm font-medium text-ink shadow-sm ring-1 ring-black/10 hover:bg-sunken active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 can-hover:h-10";

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      {icon ? <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-3 shadow-sm ring-1 ring-black/5">{icon}</span> : null}
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-sm text-ink-2">{children}</div> : null}
    </div>
  );
}

/** Bloque de carga con pulso suave, en la forma de lo que va a aparecer. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-zinc-200 ${className}`} />;
}
