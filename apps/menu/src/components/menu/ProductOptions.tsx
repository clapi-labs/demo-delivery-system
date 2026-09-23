"use client";

import { useState } from "react";

import { formatCOP, type CatalogProduct } from "@sistema/shared";

type Props = {
  product: CatalogProduct;
  onClose: () => void;
  /** `goToCart` agrega y abre el carrito de una, sin obligar a buscar el
   *  botón de abajo — es el camino de quien ya sabe que va a pedir eso. */
  onConfirm: (optionIds: number[], quantity: number, goToCart: boolean) => void;
};

/**
 * La ficha de personalización (RF-20).
 *
 * Solo aparece para productos con `optionGroups` — la mayoría del catálogo no
 * los tiene y usa el botón simple de `ProductCard`. "single" se comporta como
 * radio (una elección reemplaza a la anterior); "multi" se acumula.
 */
export function ProductOptions({ product, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<Record<number, number[]>>({});
  const [quantity, setQuantity] = useState(1);

  const toggle = (groupId: number, optionId: number, type: "single" | "multi") => {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (type === "single") {
        return { ...prev, [groupId]: current.includes(optionId) ? [] : [optionId] };
      }
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [groupId]: next };
    });
  };

  const missingRequired = product.optionGroups.some(
    (g) => g.required && (selected[g.id]?.length ?? 0) === 0,
  );

  const optionIds = Object.values(selected).flat();
  const allOptions = product.optionGroups.flatMap((g) => g.options);
  const unitPrice =
    product.price +
    allOptions
      .filter((o) => optionIds.includes(o.id))
      .reduce((sum, o) => sum + o.priceDelta, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div onClick={onClose} className="absolute inset-0 bg-background/80" />
      <div className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[14px] border-t border-border-strong bg-surface sm:max-w-md sm:rounded-[14px] sm:border">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-none">{product.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="h-9 w-9 shrink-0 rounded-[8px] border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {product.optionGroups.map((group) => (
            <div key={group.id}>
              <p className="eyebrow">
                {group.name}
                {group.required ? " · obligatorio" : ""}
              </p>
              <div className="mt-2 space-y-2">
                {group.options.map((option) => {
                  const checked = (selected[group.id] ?? []).includes(option.id);
                  return (
                    <button
                      key={option.id}
                      onClick={() => toggle(group.id, option.id, group.type)}
                      className={`flex w-full items-center justify-between rounded-[8px] border px-3 py-2 text-left text-sm transition-colors ${
                        checked
                          ? "border-accent bg-accent/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-border-strong"
                      }`}
                    >
                      <span>{option.name}</span>
                      {option.priceDelta !== 0 ? (
                        <span>
                          {option.priceDelta > 0 ? "+" : ""}
                          {formatCOP(option.priceDelta)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <footer className="border-t border-border bg-surface-2 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex h-11 items-center gap-1 rounded-[8px] border border-border bg-secondary px-1">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Quitar una unidad"
                className="h-9 w-10 rounded-[6px] text-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                −
              </button>
              <span className="w-8 text-center font-display text-lg">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Agregar una unidad"
                className="h-9 w-10 rounded-[6px] text-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                +
              </button>
            </div>
            <span className="font-display text-xl text-accent">
              {formatCOP(unitPrice * quantity)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              disabled={missingRequired}
              onClick={() => onConfirm(optionIds, quantity, false)}
              className="h-12 rounded-[8px] border border-border-strong bg-secondary text-sm font-semibold uppercase tracking-[0.1em] text-secondary-foreground transition-colors hover:border-accent disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground"
            >
              Agregar
            </button>
            <button
              disabled={missingRequired}
              onClick={() => onConfirm(optionIds, quantity, true)}
              className="h-12 rounded-[8px] bg-primary text-sm font-semibold uppercase tracking-[0.1em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              Ir a pagar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
