"use client";

import { useEffect, type ReactNode } from "react";

import { CloseIcon } from "./icons";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Hoja de edición: sube desde abajo en el celular (el pulgar alcanza todo) y
 * entra por la derecha en pantalla grande. Escape y tocar afuera la cierran.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-ink/30 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <section
        role="dialog"
        aria-modal="true"
        className={`absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-xl bg-surface shadow-2xl transition-transform duration-250 ease-out lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[30rem] lg:rounded-none ${
          open ? "translate-y-0 lg:translate-x-0" : "translate-y-full lg:translate-x-full lg:translate-y-0"
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong lg:hidden" />
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 pb-4 pt-3 lg:px-6 lg:pt-5">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-semibold leading-tight">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-sm text-ink-2">{subtitle}</div> : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 shrink-0 rounded-md p-2 text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 lg:px-6">{children}</div>

        {footer ? (
          <footer className="border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:px-6 lg:py-4">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
