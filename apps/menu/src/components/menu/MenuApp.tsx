"use client";

import { useEffect, useMemo, useState } from "react";

import Image from "next/image";

import {
  flatten,
  formatCOP,
  searchProducts,
  priceLine,
  type CatalogCategory,
  type CatalogProduct,
  type Promotion,
} from "@sistema/shared";

import heroImage from "@/assets/hero-grill.jpg";
import { cartLineKey, type CartItem } from "@/lib/cart";

import { CartPanel } from "./CartPanel";
import { ProductCard } from "./ProductCard";
import { ProductOptions } from "./ProductOptions";
import { useCart } from "./use-cart";
import { useScrollHeat } from "./use-scroll-heat";
import { useServiceStatus } from "./use-service-status";

type Business = {
  name: string;
  tagline: string;
  hours: string;
  address: string;
  deliveryFee: number;
  whatsappNumber: string;
};

type Props = {
  catalog: CatalogCategory[];
  promotions: Promotion[];
  initialQuery: string;
  initialAdd: CartItem[];
  token: string | null;
  business: Business;
};

/**
 * El catálogo público (Fase 4, RF-20 a RF-27).
 *
 * A propósito NO tiene un paso de "tus datos" en esta pantalla: el carrito
 * los pide en su propio paso (`CartPanel`), no acá — el menú arma el pedido
 * y lo manda.
 */
export function MenuApp({ catalog, promotions, initialQuery, initialAdd, token, business }: Props) {
  const products = useMemo(() => flatten(catalog), [catalog]);

  // La promoción que corre AHORA para cada producto, resuelta con la misma
  // función que usa el servidor al cobrar (`priceLine`): la tarjeta no puede
  // prometer un precio distinto del que va a salir en el pedido.
  const promoBySku = useMemo(() => {
    const now = new Date();
    return new Map(
      products.map((p) => {
        const priced = priceLine(p, [], 1, promotions, now);
        return [p.sku, { promotion: priced.promotion, price: priced.unitPrice }];
      }),
    );
  }, [products, promotions]);
  const cart = useCart(products, initialAdd, promotions);
  const status = useServiceStatus();
  useScrollHeat();

  const [query, setQuery] = useState(initialQuery);
  const [cartOpen, setCartOpen] = useState(false);
  const [active, setActive] = useState(catalog[0]?.slug ?? "");
  const [optionsFor, setOptionsFor] = useState<CatalogProduct | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Cambia en cada añadido para reiniciar la animación del contador.
  const [bump, setBump] = useState(0);

  /** Precio de entrada por sección: orienta antes de abrir la lista. */
  const fromPrice = useMemo(() => {
    const result: Record<string, number> = {};
    for (const c of catalog) {
      const prices = c.products.map((p) => p.price);
      if (prices.length) result[c.slug] = Math.min(...prices);
    }
    return result;
  }, [catalog]);

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
    setToast(`${product.name}, agregado`);
    setBump((b) => b + 1);
  };
  const handleQuickRemove = (product: CatalogProduct) => {
    cart.removeOne(cartLineKey(product.sku, []));
  };
  const handleConfirmOptions = (optionIds: number[], quantity: number, goToCart: boolean) => {
    if (!optionsFor) return;
    cart.add(optionsFor.sku, optionIds, quantity);
    setBump((b) => b + 1);
    setOptionsFor(null);
    if (goToCart) {
      setCartOpen(true);
    } else {
      setToast(`${optionsFor.name}, agregado`);
    }
  };

  const searchResults = query.trim() ? searchProducts(catalog, query) : null;

  return (
    <div className="min-h-screen bg-background">
      {/*
        La parrilla como material: brasa arriba, ceniza abajo. Fijas al
        viewport y en z negativo, por detrás de todo lo que se lee — sólo
        tiñen el aire.
      */}
      <div aria-hidden className="heat-ember pointer-events-none fixed inset-0 -z-10" />
      <div aria-hidden className="heat-ash pointer-events-none fixed inset-0 -z-10" />

      <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
          <a href="#top" className="font-display text-2xl leading-none text-flour">
            {business.name}
          </a>

          <nav className="hidden items-center gap-7 lg:flex">
            {catalog.map((c) => (
              <button
                key={c.slug}
                onClick={() => goTo(c.slug)}
                className={`text-sm transition-colors ${
                  active === c.slug ? "text-ember" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.name}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setCartOpen(true)}
            className="relative flex h-11 items-center gap-2.5 rounded-[8px] border border-border-strong bg-secondary px-4 text-sm font-medium transition-colors hover:border-ember"
          >
            Carrito
            <span
              key={bump}
              className="count-bump tnum flex h-6 min-w-6 items-center justify-center rounded-[4px] bg-primary px-1 text-sm font-semibold text-primary-foreground"
            >
              {cart.count}
            </span>
          </button>
        </div>
      </header>

      <section id="top" className="relative isolate">
        <Image
          src={heroImage}
          alt="Parrilla de carbón encendida en la cocina"
          priority
          sizes="100vw"
          className="h-[58vh] min-h-[340px] w-full object-cover sm:h-[62vh]"
        />
        <div aria-hidden className="hero-scrim absolute inset-0" />
        <div aria-hidden className="hero-heat ember-glow absolute inset-0" />
        <div aria-hidden className="hero-fade absolute inset-0" />

        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-7xl px-4 pb-9 lg:px-8 lg:pb-14">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  status?.open ? "bg-ember" : "bg-border-strong"
                }`}
              />
              {status ? status.label : business.hours}
            </p>

            <h1 className="display-hero mt-3 max-w-2xl text-flour">{business.name}</h1>

            <p className="mt-4 max-w-md text-base text-muted-foreground">
              {business.tagline ? `${business.tagline}. ` : ""}
              {business.address ? `Estamos en ${business.address} y llevamos a domicilio a toda la ciudad.` : ""}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pt-6 lg:px-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en el menú…"
          className="h-11 w-full rounded-[8px] border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ember"
        />
      </div>

      {!searchResults ? (
        <div className="sticky top-16 z-30 border-b border-border bg-background/92 backdrop-blur lg:hidden">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
            {catalog.map((c) => (
              <button
                key={c.slug}
                onClick={() => goTo(c.slug)}
                className={`shrink-0 rounded-[6px] border px-3.5 py-2 text-sm transition-colors ${
                  active === c.slug
                    ? "border-ember bg-ember text-background"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-7xl px-4 pb-32 lg:flex lg:gap-20 lg:px-8">
        {/*
          Índice de la carta. El filete vertical es la espina: la sección en
          la que estás se marca con un tramo de brasa sobre ese mismo filete.
        */}
        {!searchResults ? (
          <aside className="hidden w-80 shrink-0 lg:block">
            <nav
              aria-label="Secciones de la carta"
              className="no-scrollbar sticky top-28 max-h-[calc(100dvh-9rem)] overflow-y-auto py-14"
            >
              <ul className="border-l border-border">
                {catalog.map((c) => {
                  const here = active === c.slug;
                  return (
                    <li key={c.slug} className="relative">
                      <span
                        aria-hidden
                        className={`absolute -left-px top-0 h-full w-[2px] transition-colors ${
                          here ? "bg-ember" : "bg-transparent"
                        }`}
                      />
                      <button
                        onClick={() => goTo(c.slug)}
                        aria-current={here ? "true" : undefined}
                        className={`flex w-full items-baseline justify-between gap-4 py-5 pl-8 pr-3 text-left transition-colors ${
                          here ? "text-ember" : "text-muted-foreground hover:text-flour"
                        }`}
                      >
                        <span className="display-item">{c.name}</span>
                        <span
                          className={`tnum text-sm transition-colors ${
                            here ? "text-ember/70" : "text-muted-foreground/60"
                          }`}
                        >
                          {c.products.length}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>
        ) : null}

        <div className="min-w-0 flex-1">
          {searchResults ? (
            <section>
              <div className="border-b border-border-strong pb-3">
                <h2 className="display-section text-flour">
                  Resultados para &ldquo;{query}&rdquo;
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
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
                    promotion={promoBySku.get(p.sku)?.promotion ?? null}
                    promoPrice={promoBySku.get(p.sku)?.price ?? p.price}
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
              <section key={c.slug} id={c.slug} className="scroll-mt-32 pt-12 lg:pt-16">
                <div className="relative flex items-end justify-between gap-4 border-b border-border-strong pb-3">
                  <span
                    aria-hidden
                    className={`section-coal pointer-events-none absolute -z-10 transition-opacity duration-700 ${
                      active === c.slug ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <h2 className="display-section text-flour">{c.name}</h2>
                  {fromPrice[c.slug] ? (
                    <p className="tnum shrink-0 pb-1 text-sm text-muted-foreground">
                      Desde {formatCOP(fromPrice[c.slug]!)}
                    </p>
                  ) : null}
                </div>

                <div className="sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                  {c.products.map((p) => (
                    <ProductCard
                      key={p.sku}
                      product={p}
                      promotion={promoBySku.get(p.sku)?.promotion ?? null}
                      promoPrice={promoBySku.get(p.sku)?.price ?? p.price}
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

          <footer className="mt-24 border-t border-border pt-8 text-sm text-muted-foreground">
            <p className="font-display text-2xl text-flour">{business.name}</p>
            <p className="mt-3">{business.address}</p>
            <p>{business.hours}</p>
            <p className="mt-3">Domicilios en toda la ciudad. Los pedidos se confirman por WhatsApp.</p>
          </footer>
        </div>
      </main>

      {cart.count > 0 && !cartOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-strong bg-surface px-4 py-3 lg:hidden">
          <button
            onClick={() => setCartOpen(true)}
            className="flex h-13 w-full items-center justify-between rounded-[8px] bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
          >
            <span>
              Ver pedido, {cart.count} {cart.count === 1 ? "producto" : "productos"}
            </span>
            <span className="tnum text-base font-semibold">{formatCOP(cart.subtotal)}</span>
          </button>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-[6px] border border-ember/40 bg-surface-2 px-4 py-2 text-sm text-foreground shadow-[0_12px_32px_-12px_rgba(0,0,0,0.8)]"
        >
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
        fullSubtotal={cart.fullSubtotal}
        deliveryFee={business.deliveryFee}
        businessName={business.name}
        token={token}
        onIncrement={(l) => cart.add(l.product.sku, l.optionIds, 1)}
        onDecrement={(l) => cart.removeOne(l.key)}
        onRemoveLine={(l) => cart.removeAll(l.key)}
        onSent={() => cart.clear()}
      />
    </div>
  );
}
