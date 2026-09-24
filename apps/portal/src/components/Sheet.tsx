"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";

import { useMedia } from "@/lib/use-media";

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
  // Desde tablet entra por la derecha; en el celular sube desde abajo.
  const wide = useMedia("(min-width: 768px)");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const hidden = wide ? { x: "100%" } : { y: "100%" };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.div
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-zinc-950/30 backdrop-blur-[2px]"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            initial={hidden}
            animate={{ x: 0, y: 0 }}
            exit={hidden}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl bg-surface shadow-2xl md:inset-y-2 md:left-auto md:right-2 md:max-h-none md:w-[min(30rem,calc(100vw-1rem))] md:rounded-2xl"
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong md:hidden" />
            <header className="flex items-start justify-between gap-3 border-b border-line px-5 pb-4 pt-3 md:px-6 md:pt-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-title">{title}</h2>
                {subtitle ? <div className="mt-0.5 text-sm text-ink-2">{subtitle}</div> : null}
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="ease-ui -mr-2 shrink-0 rounded-full p-2 text-ink-3 hover:bg-sunken hover:text-ink"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-6">{children}</div>

            {footer ? (
              <footer className="border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:py-4">
                {footer}
              </footer>
            ) : null}
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
