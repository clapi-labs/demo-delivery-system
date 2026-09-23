"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { CloseIcon } from "@/components/icons";

/**
 * Avisos cortos abajo de la pantalla. El más importante es "Deshacer": cada
 * cambio rápido (deslizar un pedido, apagar un producto) se puede revertir
 * desde aquí, que es lo que permite quitarle confirmaciones al flujo.
 */

type ToastInput = {
  message: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  /** ms; los que traen acción duran más para alcanzar a tocarla. */
  duration?: number;
};

type Toast = ToastInput & { id: number };

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast fuera de ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++seq.current;
      // Máximo tres a la vez: más que eso ya no se leen.
      setToasts((prev) => [...prev.slice(-2), { ...input, id }]);
      setTimeout(() => dismiss(id), input.duration ?? (input.action ? 6000 : 3500));
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-tabbar z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              role="status"
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
              className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-zinc-900 py-2.5 pl-4 pr-2 text-sm text-zinc-50 shadow-lg shadow-black/15 ring-1 ring-white/10"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.message}</p>
                {t.description ? <p className="truncate text-zinc-400">{t.description}</p> : null}
              </div>
              {t.action ? (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="ease-ui shrink-0 rounded-lg px-3 py-2 font-semibold text-brand hover:bg-white/10"
                >
                  {t.action.label}
                </button>
              ) : null}
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Cerrar aviso"
                className="ease-ui shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-50"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
