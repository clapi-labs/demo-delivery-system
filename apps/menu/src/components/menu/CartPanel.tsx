"use client";

import { useState } from "react";

import Image from "next/image";

import { formatCOP, orderCodeMessage, type PaymentMethod } from "@sistema/shared";

import { categoryImage } from "@/lib/category-images";
import { isMobileDevice, whatsappChatUrl } from "@/lib/whatsapp";

import type { CartLine } from "./use-cart";
import { WhatsAppIcon } from "./WhatsAppIcon";

type OrderResult = { code: string; delivered: boolean; whatsappNumber: string };

type Props = {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  businessName: string;
  token: string | null;
  onIncrement: (line: CartLine) => void;
  onDecrement: (line: CartLine) => void;
  onRemoveLine: (line: CartLine) => void;
  onSent: () => void;
};

type Step = "cart" | "data";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: "efectivo", label: "Efectivo", hint: "Pagas al recibir" },
  { value: "datafono", label: "Datáfono", hint: "Tarjeta al recibir" },
  { value: "transferencia", label: "Transferencia", hint: "Nequi o banco" },
];

/**
 * El carrito y el envío del pedido (RF-21, RF-26, RF-27).
 *
 * Recoge nombre, dirección y método de pago **acá**, no por chat: el cliente
 * ya está escribiendo en un teclado con el pedido a la vista, que es mejor
 * momento para dar una dirección que tres turnos de WhatsApp después. El bot
 * solo confirma (`bot/engine.ts`).
 *
 * El candado de ADR-02 no cambia: el pedido sigue naciendo del menú y
 * cerrándose contra un código canjeado.
 */
export function CartPanel({
  open,
  onClose,
  lines,
  subtotal,
  deliveryFee,
  businessName,
  token,
  onIncrement,
  onDecrement,
  onRemoveLine,
  onSent,
}: Props) {
  const [step, setStep] = useState<Step>("cart");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);

  const total = subtotal + (subtotal > 0 ? deliveryFee : 0);
  // La dirección es lo único obligatorio además del pago: sin ella no hay a
  // dónde despachar. El nombre ayuda pero no bloquea.
  const dataReady = address.trim().length > 7 && payment !== null;

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
          customerName: name.trim() || null,
          address: address.trim(),
          paymentMethod: payment,
        }),
      });

      if (!response.ok) {
        setError("No pudimos enviar el pedido. Intenta de nuevo.");
        return;
      }

      const data = (await response.json()) as OrderResult;
      setResult(data);
      onSent();

      // El pedido YA salió y el bot ya contestó por WhatsApp: el siguiente
      // paso del cliente es leer esa confirmación, así que en celular se le
      // abre el chat solo. En computador no se redirige a nadie —abrir
      // WhatsApp Web en una pestaña nueva provoca el "WhatsApp está abierto
      // en otra ventana" si ya lo tenía abierto—, ahí el link queda como
      // opción en la pantalla de confirmación.
      if (data.delivered && data.whatsappNumber && isMobileDevice()) {
        window.location.href = whatsappChatUrl(data.whatsappNumber);
      }
    } catch {
      setError("No pudimos enviar el pedido. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    onClose();
    if (result) {
      // Pedido ya enviado: se limpia todo para que el siguiente empiece de
      // cero. Si el panel se cierra a medio camino NO se borra nada — volver
      // a escribir la dirección porque cerraste sin querer es lo peor.
      setResult(null);
      setStep("cart");
      setName("");
      setAddress("");
      setPayment(null);
    }
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
          <div>
            {!result && lines.length > 0 ? (
              <p className="eyebrow">{step === "cart" ? "Paso 1 de 2" : "Paso 2 de 2"}</p>
            ) : null}
            <h2 className="font-display text-2xl leading-none">
              {result ? "Pedido guardado" : step === "cart" ? "Tu pedido" : "Tus datos"}
            </h2>
          </div>
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
            <ResultView result={result} businessName={businessName} />
          ) : lines.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Tu carrito está vacío. Explora el menú y agrega algo rico.
            </p>
          ) : step === "data" ? (
            <div className="space-y-5">
              <label className="block">
                <span className="eyebrow">¿A nombre de quién?</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="mt-2 h-12 w-full rounded-[8px] border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent"
                />
              </label>

              <label className="block">
                <span className="eyebrow">Dirección de entrega</span>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder="Calle 10 #20-30, apto 301, barrio Centro. Punto de referencia: al lado de la panadería."
                  className="mt-2 w-full resize-none rounded-[8px] border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent"
                />
                <span className="mt-1.5 block text-xs text-muted-foreground">
                  Incluye el barrio y algún punto de referencia — es lo que hace que
                  llegue rápido.
                </span>
              </label>

              <div>
                <p className="eyebrow mb-2">¿Cómo vas a pagar?</p>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPayment(opt.value)}
                      className={`rounded-[8px] border px-2 py-3 text-center transition-colors ${
                        payment === opt.value
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border bg-secondary text-muted-foreground hover:border-border-strong hover:text-foreground"
                      }`}
                    >
                      <span className="block text-xs font-semibold uppercase tracking-[0.1em]">
                        {opt.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] opacity-80">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
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

            <div className="mt-4 flex gap-2">
              {step === "data" ? (
                <button
                  onClick={() => setStep("cart")}
                  className="h-12 rounded-[8px] border border-border px-4 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Atrás
                </button>
              ) : null}

              {step === "cart" ? (
                <button
                  onClick={() => setStep("data")}
                  className="h-12 flex-1 rounded-[8px] bg-primary text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Continuar
                </button>
              ) : (
                <button
                  disabled={sending || !dataReady}
                  onClick={sendOrder}
                  className="h-12 flex-1 rounded-[8px] bg-whatsapp text-sm font-semibold uppercase tracking-[0.12em] text-whatsapp-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                >
                  {sending ? "Enviando…" : "Enviar pedido"}
                </button>
              )}
            </div>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

/**
 * La pantalla final del carrito.
 *
 * Tiene dos versiones, y la diferencia no es cosmética: es de quién es el
 * siguiente paso.
 *
 * - `delivered` → el bot YA canjeó el pedido y contestó por WhatsApp. No
 *   queda nada por hacer; el botón es una comodidad para ir a leerlo.
 * - `!delivered` → el pedido está guardado, pero el bot todavía no sabe de
 *   quién es y solo lo sabrá cuando llegue el mensaje. Acá el botón NO es
 *   opcional, y el texto tiene que decirlo sin rodeos.
 *
 * Escribir "¡listo!" en el segundo caso sería mentirle al cliente: creería
 * que su pedido va en camino cuando en realidad nadie lo ha visto.
 */
function ResultView({
  result,
  businessName,
}: {
  result: OrderResult;
  businessName: string;
}) {
  const number = result.whatsappNumber;

  if (result.delivered) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="font-display text-3xl">¡Pedido enviado!</p>
        <p className="text-sm tabular-nums text-muted-foreground">Código {result.code}</p>
        <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
          Ya le mandé tu pedido a {businessName} por WhatsApp. Abre tu chat para ver la
          confirmación y darnos la dirección.
        </p>
        {number ? (
          <a
            href={whatsappChatUrl(number)}
            className="mx-auto flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-[8px] bg-whatsapp text-sm font-semibold uppercase tracking-[0.12em] text-whatsapp-foreground transition-opacity hover:opacity-90"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Abrir WhatsApp
          </a>
        ) : null}
      </div>
    );
  }

  const message = orderCodeMessage(result.code);

  return (
    <div className="space-y-4 py-8 text-center">
      <p className="font-display text-3xl">Falta un paso</p>
      <p className="text-sm tabular-nums text-muted-foreground">Código {result.code}</p>
      <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
        Abre WhatsApp y <strong className="text-foreground">envía el mensaje</strong> que
        te queda escrito. Tu pedido no llega hasta que lo mandes.
      </p>
      {number ? (
        <a
          href={whatsappChatUrl(number, message)}
          className="mx-auto flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-[8px] bg-whatsapp text-sm font-semibold uppercase tracking-[0.12em] text-whatsapp-foreground transition-opacity hover:opacity-90"
        >
          <WhatsAppIcon className="h-5 w-5" />
          Abrir WhatsApp y enviar
        </a>
      ) : (
        <p className="font-display text-lg">{message}</p>
      )}
    </div>
  );
}
