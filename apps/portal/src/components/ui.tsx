import type { ReactNode } from "react";

import { ORDER_STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/lib/orders";

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
        <h1 className="font-display text-[2rem] font-semibold leading-none tracking-tight">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone.soft} ${tone.ink}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {ORDER_STATUS_LABEL[status]}
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
  const shift = size === "sm" ? "translate-x-4" : "translate-x-5";
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
      className={`relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors ${track} ${
        checked ? "bg-st-done" : "bg-line-strong"
      }`}
    >
      <span
        className={`rounded-full bg-white shadow-sm transition-transform ${knob} ${checked ? shift : "translate-x-0"}`}
      />
    </button>
  );
}

/** Control segmentado: filtros y cambios de vista. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={`flex gap-1 rounded-lg bg-sunken p-1 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
            }`}
          >
            {o.label}
            {o.count !== undefined ? (
              <span
                className={`min-w-5 rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                  active ? "bg-ink text-surface" : "bg-line text-ink-2"
                }`}
              >
                {o.count}
              </span>
            ) : null}
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
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3"
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
  "h-11 w-full rounded-lg border border-line bg-surface px-3 text-[15px] outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3 lg:h-10 lg:text-sm";

export const buttonPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:opacity-40 lg:h-10";

export const buttonSecondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-ink-3 disabled:opacity-40 lg:h-10";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-1 text-sm text-ink-2">{children}</div> : null}
    </div>
  );
}
