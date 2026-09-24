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
  /** Lo que costaría sin promociones; si es mayor, se muestra el ahorro. */
  fullSubtotal: number;
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
  fullSubtotal,
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
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [detail, setDetail] = useState("");
  const [reference, setReference] = useState("");
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);

  const total = subtotal + (subtotal > 0 ? deliveryFee : 0);
  // Calle y barrio son lo único obligatorio además del pago: sin eso no hay a
  // dónde despachar. El nombre, el interior y la referencia ayudan pero no
  // bloquean.
  const dataReady = street.trim().length > 4 && neighborhood.trim().length > 1 && payment !== null;

  // Un solo string es lo que espera la base (RN-02 no aplica acá, es solo
  // texto libre) — los campos separados son para que el cliente escriba
  // mejor, no para guardarse por separado.
  const composedAddress = () =>
    [
      street.trim(),
      neighborhood.trim() ? `barrio ${neighborhood.trim()}` : null,
      detail.trim() || null,
      reference.trim() ? `referencia: ${reference.trim()}` : null,
    ]
      .filter(Boolean)
      .join(", ");

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
          address: composedAddress(),
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
      setStreet("");
      setNeighborhood("");
      setDetail("");
      setReference("");
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
            <h2 className="font-display text-2xl leading-none text-flour">
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
                  name="name"
                  autoComplete="name"
                  className="mt-2 h-12 w-full rounded-[8px] border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ember"
                />
              </label>

              <div className="space-y-3">
                <p className="eyebrow">Dirección de entrega</p>

                <label className="block">
                  <span className="text-xs text-muted-foreground">Calle o carrera y número</span>
                  <input
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Calle 10 #20-30"
                    name="street-address"
                    autoComplete="street-address"
                    className="mt-1.5 h-12 w-full rounded-[8px] border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ember"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-muted-foreground">Barrio</span>
                  <input
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Centro"
                    name="address-level2"
                    autoComplete="address-level2"
                    className="mt-1.5 h-12 w-full rounded-[8px] border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ember"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-muted-foreground">
                    Apto, casa o interior (opcional)
                  </span>
                  <input
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder="Apto 301, torre 2"
                    name="address-line2"
                    autoComplete="address-line2"
                    className="mt-1.5 h-12 w-full rounded-[8px] border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ember"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-muted-foreground">
                    Punto de referencia (opcional)
                  </span>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Al lado de la panadería"
                    name="address-reference"
                    className="mt-1.5 h-12 w-full rounded-[8px] border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ember"
                  />
                </label>
              </div>

              <div>
                <p className="eyebrow mb-2">¿Cómo vas a pagar?</p>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPayment(opt.value)}
                      className={`rounded-[8px] border px-2 py-3 text-center transition-colors ${
                        payment === opt.value
                          ? "border-ember bg-ember text-background"
                          : "border-border bg-secondary text-muted-foreground hover:border-border-strong hover:text-foreground"
                      }`}
                    >
                      <span className="block text-sm font-medium">{opt.label}</span>
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
                      <p className="truncate text-sm font-semibold text-flour">{l.product.name}</p>
                      <span className="flex shrink-0 items-baseline gap-2">
                        {l.lineTotal < l.fullUnitPrice * l.quantity ? (
                          <span className="tnum text-xs text-muted-foreground line-through">
                            {formatCOP(l.fullUnitPrice * l.quantity)}
                          </span>
                        ) : null}
                        <span className="tnum text-base font-semibold text-ember">
                          {formatCOP(l.lineTotal)}
                        </span>
                      </span>
                    </div>
                    {l.optionNames.length > 0 ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {l.optionNames.join(", ")}
                      </p>
                    ) : null}
                    {l.promotionName ? (
                      <p className="mt-0.5 truncate text-xs font-medium text-ember">{l.promotionName}</p>
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
                        className="text-xs text-muted-foreground transition-colors hover:text-destructive"
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
                <span className="tnum">{formatCOP(subtotal)}</span>
              </div>
              {fullSubtotal > subtotal ? (
                <div className="flex justify-between text-ember">
                  <span>Ahorras</span>
                  <span className="tnum">−{formatCOP(fullSubtotal - subtotal)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-muted-foreground">
                <span>Domicilio</span>
                <span className="tnum">{formatCOP(deliveryFee)}</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="eyebrow">Total</span>
                <span className="tnum font-display text-2xl text-ember">{formatCOP(total)}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {step === "data" ? (
                <button
                  onClick={() => setStep("cart")}
                  className="h-12 rounded-[8px] border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Atrás
                </button>
              ) : null}

              {step === "cart" ? (
                <button
                  onClick={() => setStep("data")}
                  className="h-12 flex-1 rounded-[8px] bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Continuar
                </button>
              ) : (
                <button
                  disabled={sending || !dataReady}
                  onClick={sendOrder}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[8px] bg-whatsapp text-sm font-medium text-whatsapp-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                >
                  <WhatsAppIcon className="h-5 w-5" />
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
        <p className="font-display text-3xl text-flour">¡Pedido enviado!</p>
        <p className="tnum text-sm text-muted-foreground">Código {result.code}</p>
        <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
          Ya le mandé tu pedido a {businessName} por WhatsApp. Abre tu chat para ver la
          confirmación y darnos la dirección.
        </p>
        {number ? (
          <a
            href={whatsappChatUrl(number)}
            className="mx-auto flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-[8px] bg-whatsapp text-sm font-medium text-whatsapp-foreground transition-opacity hover:opacity-90"
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
      <p className="font-display text-3xl text-flour">Falta un paso</p>
      <p className="tnum text-sm text-muted-foreground">Código {result.code}</p>
      <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
        Abre WhatsApp y <strong className="text-foreground">envía el mensaje</strong> que
        te queda escrito. Tu pedido no llega hasta que lo mandes.
      </p>
      {number ? (
        <a
          href={whatsappChatUrl(number, message)}
          className="mx-auto flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-[8px] bg-whatsapp text-sm font-medium text-whatsapp-foreground transition-opacity hover:opacity-90"
        >
          <WhatsAppIcon className="h-5 w-5" />
          Abrir WhatsApp y enviar
        </a>
      ) : (
        <p className="font-display text-lg text-flour">{message}</p>
      )}
    </div>
  );
}
