"use client";

import { useEffect, useMemo, useState } from "react";

import Image from "next/image";

import {
  flatten,
  formatCOP,
  searchProducts,
  type CatalogCategory,
  type CatalogProduct,
} from "@sistema/shared";

import heroImage from "@/assets/hero-grill.jpg";
import { cartLineKey, type CartItem } from "@/lib/cart";

import { CartPanel } from "./CartPanel";
import { ProductCard } from "./ProductCard";
import { ProductOptions } from "./ProductOptions";
import { useCart } from "./use-cart";

type Business = {
  name: string;
  hours: string;
  address: string;
  deliveryFee: number;
  whatsappNumber: string;
};

type Props = {
  catalog: CatalogCategory[];
  initialQuery: string;
  initialAdd: CartItem[];
  token: string | null;
  business: Business;
};

/**
 * El catálogo público (Fase 4, RF-20 a RF-27).
 *
 * A propósito NO tiene un paso de "tus datos": el menú arma el carrito y lo
 * manda; la dirección y el pago los pide el asistente por chat después de
 * canjear el código (ADR-02, `apps/bot/src/bot/engine.ts`).
 */
export function MenuApp({ catalog, initialQuery, initialAdd, token, business }: Props) {
  const products = useMemo(() => flatten(catalog), [catalog]);
  const cart = useCart(products, initialAdd);

  const [query, setQuery] = useState(initialQuery);
  const [cartOpen, setCartOpen] = useState(false);
  const [active, setActive] = useState(catalog[0]?.slug ?? "");
  const [optionsFor, setOptionsFor] = useState<CatalogProduct | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // Solo al abrir con `?add=` en la URL con la que cargó la página; no hay
    // forma de mostrar este aviso durante el render del servidor.
    if (initialAdd.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast("Ya armamos tu pedido");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (query.trim()) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-140px 0px -65% 0px" },
    );
    catalog.forEach((c) => {
      const el = document.getElementById(c.slug);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [catalog, query]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const goTo = (slug: string) => {
    document.getElementById(slug)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const quantityOf = (sku: string) =>
    cart.lines.find((l) => l.key === cartLineKey(sku, []))?.quantity ?? 0;

  const handleQuickAdd = (product: CatalogProduct) => {
    cart.add(product.sku, [], 1);
    setToast(`${product.name} agregado`);
  };
  const handleQuickRemove = (product: CatalogProduct) => {
    cart.removeOne(cartLineKey(product.sku, []));
  };
  const handleConfirmOptions = (optionIds: number[], quantity: number) => {
    if (!optionsFor) return;
    cart.add(optionsFor.sku, optionIds, quantity);
    setToast(`${optionsFor.name} agregado`);
    setOptionsFor(null);
  };

  const searchResults = query.trim() ? searchProducts(catalog, query) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 lg:px-8">
          <a href="#top" className="flex items-baseline gap-2">
            <span className="font-display text-2xl leading-none tracking-wide">
              {business.name}
            </span>
          </a>

          <nav className="hidden items-center gap-6 lg:flex">
            {catalog.map((c) => (
              <button
                key={c.slug}
                onClick={() => goTo(c.slug)}
                className={`text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                  active === c.slug
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.name}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setCartOpen(true)}
            className="relative flex h-11 items-center gap-2 rounded-[8px] border border-border-strong bg-secondary px-4 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-accent"
          >
            Carrito
            <span className="flex h-6 min-w-6 items-center justify-center rounded-[4px] bg-primary px-1 font-display text-sm text-primary-foreground">
              {cart.count}
            </span>
          </button>
        </div>
      </header>

      <section id="top" className="relative">
        <Image
          src={heroImage}
          alt="Parrilla en la cocina"
          priority
          sizes="100vw"
          className="h-[46vh] min-h-[280px] w-full object-cover sm:h-[52vh]"
        />
        <div className="absolute inset-0 bg-background/55" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-4 pb-8 lg:px-8 lg:pb-12">
            <p className="eyebrow">{business.hours}</p>
            <h1 className="mt-2 max-w-xl font-display text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
              {business.name}
            </h1>
            {business.address ? (
              <p className="mt-4 max-w-md text-sm text-muted-foreground">{business.address}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pt-6 lg:px-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en el menú…"
          className="h-11 w-full rounded-[8px] border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent"
        />
      </div>

      {!searchResults ? (
        <div className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur lg:hidden">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
            {catalog.map((c) => (
              <button
                key={c.slug}
                onClick={() => goTo(c.slug)}
                className={`shrink-0 rounded-[6px] border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                  active === c.slug
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 pb-32 lg:flex lg:gap-12 lg:px-8">
        {!searchResults ? (
          <aside className="hidden w-48 shrink-0 lg:block">
            <div className="sticky top-28 py-12">
              <p className="eyebrow">Carta</p>
              <ul className="mt-4 space-y-3">
                {catalog.map((c) => (
                  <li key={c.slug}>
                    <button
                      onClick={() => goTo(c.slug)}
                      className={`text-left text-sm transition-colors ${
                        active === c.slug
                          ? "text-accent"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        ) : null}

        <div className="min-w-0 flex-1">
          {searchResults ? (
            <section>
              <div className="border-b border-border-strong pb-3">
                <h2 className="font-display text-3xl leading-none sm:text-4xl">
                  Resultados para &ldquo;{query}&rdquo;
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchResults.length === 0
                    ? "No encontramos nada con ese nombre."
                    : `${searchResults.length} ${searchResults.length === 1 ? "opción" : "opciones"}`}
                </p>
              </div>
              <div className="sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                {searchResults.map((p) => (
                  <ProductCard
                    key={p.sku}
                    product={p}
                    quantity={quantityOf(p.sku)}
                    onQuickAdd={() => handleQuickAdd(p)}
                    onQuickRemove={() => handleQuickRemove(p)}
                    onOpenOptions={() => setOptionsFor(p)}
                  />
                ))}
              </div>
            </section>
          ) : (
            catalog.map((c) => (
              <section key={c.slug} id={c.slug} className="scroll-mt-32 pt-10 lg:pt-14">
                <div className="flex items-end justify-between gap-4 border-b border-border-strong pb-3">
                  <h2 className="font-display text-3xl leading-none sm:text-4xl">{c.name}</h2>
                  <span className="font-display text-sm text-muted-foreground">
                    {c.products.length} opciones
                  </span>
                </div>
                <div className="sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                  {c.products.map((p) => (
                    <ProductCard
                      key={p.sku}
                      product={p}
                      quantity={quantityOf(p.sku)}
                      onQuickAdd={() => handleQuickAdd(p)}
                      onQuickRemove={() => handleQuickRemove(p)}
                      onOpenOptions={() => setOptionsFor(p)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          <footer className="mt-20 border-t border-border pt-8 text-sm text-muted-foreground">
            <p className="font-display text-xl text-foreground">{business.name}</p>
            <p className="mt-2">
              {business.address ? `${business.address} · ` : ""}
              {business.hours}
            </p>
          </footer>
        </div>
      </main>

      {cart.count > 0 && !cartOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-strong bg-surface px-4 py-3 lg:hidden">
          <button
            onClick={() => setCartOpen(true)}
            className="flex h-13 w-full items-center justify-between rounded-[8px] bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground"
          >
            <span>
              Ver pedido · {cart.count} {cart.count === 1 ? "producto" : "productos"}
            </span>
            <span className="font-display text-lg">{formatCOP(cart.subtotal)}</span>
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-[6px] border border-border-strong bg-surface-2 px-4 py-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {toast}
        </div>
      ) : null}

      {optionsFor ? (
        <ProductOptions
          product={optionsFor}
          onClose={() => setOptionsFor(null)}
          onConfirm={handleConfirmOptions}
        />
      ) : null}

      <CartPanel
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={cart.lines}
        subtotal={cart.subtotal}
        deliveryFee={business.deliveryFee}
        businessName={business.name}
        whatsappNumber={business.whatsappNumber}
        token={token}
        onIncrement={(l) => cart.add(l.product.sku, l.optionIds, 1)}
        onDecrement={(l) => cart.removeOne(l.key)}
        onRemoveLine={(l) => cart.removeAll(l.key)}
        onSent={() => cart.clear()}
      />
    </div>
  );
}
