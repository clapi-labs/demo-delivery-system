"use client";

import { useState } from "react";

import Image from "next/image";

import { formatCOP, orderCodeMessage } from "@sistema/shared";

import { categoryImage } from "@/lib/category-images";

import type { CartLine } from "./use-cart";
import { WhatsAppIcon } from "./WhatsAppIcon";

type OrderResult = { code: string; delivered: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  businessName: string;
  whatsappNumber: string;
  token: string | null;
  onIncrement: (line: CartLine) => void;
  onDecrement: (line: CartLine) => void;
  onRemoveLine: (line: CartLine) => void;
  onSent: () => void;
};

/**
 * El carrito y el envío del pedido (RF-21, RF-26, RF-27).
 *
 * A propósito NO pide nombre, dirección ni método de pago: eso lo recoge el
 * asistente por chat después de canjear el código (ADR-02, `bot/engine.ts`).
 * El menú solo arma el carrito y lo manda.
 */
export function CartPanel({
  open,
  onClose,
  lines,
  subtotal,
  deliveryFee,
  businessName,
  whatsappNumber,
  token,
  onIncrement,
  onDecrement,
  onRemoveLine,
  onSent,
}: Props) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);

  const total = subtotal + (subtotal > 0 ? deliveryFee : 0);

  const sendOrder = async () => {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({
            sku: l.product.sku,
            optionIds: l.optionIds,
            quantity: l.quantity,
          })),
          token,
        }),
      });

      if (!response.ok) {
        setError("No pudimos enviar el pedido. Intenta de nuevo.");
        return;
      }

      const data = (await response.json()) as OrderResult;
      setResult(data);
      onSent();
    } catch {
      setError("No pudimos enviar el pedido. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    onClose();
    if (result) setResult(null);
    setError(null);
  };

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={close}
        className={`absolute inset-0 bg-background/80 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-[14px] border-t border-border-strong bg-surface transition-transform duration-300 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:max-h-none sm:rounded-none sm:border-l sm:border-t-0 ${
          open
            ? "translate-y-0 sm:translate-x-0"
            : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-2xl leading-none">
            {result ? "Pedido guardado" : "Tu pedido"}
          </h2>
          <button
            onClick={close}
            aria-label="Cerrar"
            className="h-10 w-10 rounded-[8px] border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {result ? (
            <ResultView
              result={result}
              businessName={businessName}
              whatsappNumber={whatsappNumber}
            />
          ) : lines.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Tu carrito está vacío. Explora el menú y agrega algo rico.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {lines.map((l) => (
                <li key={l.key} className="flex gap-3 py-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[6px] bg-muted">
                    {l.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.product.imageUrl}
                        alt={l.product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Image
                        src={categoryImage(l.product.categorySlug)}
                        alt={l.product.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{l.product.name}</p>
                      <span className="shrink-0 font-display text-base text-accent">
                        {formatCOP(l.unitPrice * l.quantity)}
                      </span>
                    </div>
                    {l.optionNames.length > 0 ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {l.optionNames.join(", ")}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex h-9 items-center gap-1 rounded-[6px] border border-border bg-secondary px-1">
                        <button
                          onClick={() => onDecrement(l)}
                          aria-label="Quitar uno"
                          className="h-7 w-8 rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm">{l.quantity}</span>
                        <button
                          onClick={() => onIncrement(l)}
                          aria-label="Agregar uno"
                          className="h-7 w-8 rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => onRemoveLine(l)}
                        className="text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-destructive"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </div>

        {!result && lines.length > 0 ? (
          <footer className="border-t border-border bg-surface-2 px-5 py-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCOP(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Domicilio</span>
                <span>{formatCOP(deliveryFee)}</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="eyebrow">Total</span>
                <span className="font-display text-2xl text-accent">{formatCOP(total)}</span>
              </div>
            </div>

            <button
              disabled={sending}
              onClick={sendOrder}
              className="mt-4 h-12 w-full rounded-[8px] bg-primary text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {sending ? "Enviando…" : "Enviar pedido"}
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

function ResultView({
  result,
  businessName,
  whatsappNumber,
}: {
  result: OrderResult;
  businessName: string;
  whatsappNumber: string;
}) {
  if (result.delivered) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="font-display text-2xl">¡Listo!</p>
        <p className="text-sm text-muted-foreground">
          {businessName} ya te escribió por WhatsApp para confirmar tu pedido. Revisa el
          chat.
        </p>
      </div>
    );
  }

  const message = orderCodeMessage(result.code);
  const waLink = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="space-y-4 py-6 text-center">
      <p className="font-display text-2xl">Un paso más</p>
      <p className="text-sm text-muted-foreground">
        Tu pedido quedó guardado con el código{" "}
        <strong className="text-foreground">{result.code}</strong>. Para confirmarlo,
        mándanos este mensaje por WhatsApp:
      </p>
      {waLink ? (
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="mx-auto flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-[8px] bg-whatsapp text-sm font-semibold uppercase tracking-[0.12em] text-whatsapp-foreground transition-opacity hover:opacity-90"
        >
          <WhatsAppIcon className="h-5 w-5" />
          Enviar {message}
        </a>
      ) : (
        <p className="font-display text-lg">{message}</p>
      )}
    </div>
  );
}
