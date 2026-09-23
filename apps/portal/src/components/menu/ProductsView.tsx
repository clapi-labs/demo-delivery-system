"use client";

import { useMemo, useState } from "react";

import { formatCOP, normalize } from "@sistema/shared";

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronRightIcon, PlusIcon, SortIcon, TagIcon } from "@/components/icons";
import { useMenu } from "@/components/providers/MenuProvider";
import { EmptyState, SearchField, Switch, buttonPrimary, buttonSecondary } from "@/components/ui";
import { appliesTo, promoPrice, type MenuCategory, type MenuProduct } from "@/lib/menu";

import { CategoryEditor, ProductEditor, emptyProduct } from "./ProductEditor";

function MoveButtons({ onUp, onDown, label }: { onUp?: () => void; onDown?: () => void; label: string }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button
        onClick={onUp}
        disabled={!onUp}
        aria-label={`Subir ${label}`}
        className="rounded-md p-2 text-ink-2 ring-1 ring-line transition-colors hover:bg-sunken hover:text-ink disabled:opacity-30"
      >
        <ArrowUpIcon className="h-4 w-4" />
      </button>
      <button
        onClick={onDown}
        disabled={!onDown}
        aria-label={`Bajar ${label}`}
        className="rounded-md p-2 text-ink-2 ring-1 ring-line transition-colors hover:bg-sunken hover:text-ink disabled:opacity-30"
      >
        <ArrowDownIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Los productos, agrupados como los ve el cliente. Lo más frecuente —
 * marcar algo como agotado— es un interruptor en la misma fila, sin abrir
 * nada. Editar es tocar la fila. Reordenar vive en un modo aparte para que
 * no estorbe el resto del tiempo.
 */
export function ProductsView() {
  const { categories, products, promotions, toggleAvailable, moveProduct, moveCategory } = useMenu();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [editing, setEditing] = useState<MenuProduct | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);

  const q = normalize(query.trim());
  const soldOut = products.filter((p) => !p.available).length;
  const activePromos = promotions.filter((p) => p.active);

  const sections = useMemo(
    () =>
      categories
        .filter((c) => categoryFilter === null || c.id === categoryFilter)
        .map((category) => ({
          category,
          items: products.filter(
            (p) =>
              p.categoryId === category.id &&
              (!q || normalize(p.name).includes(q) || normalize(p.description).includes(q)),
          ),
        }))
        .filter((s) => !q || s.items.length > 0),
    [categories, products, categoryFilter, q],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Buscar producto"
          className="min-w-0 flex-1 sm:max-w-xs"
        />
        <button
          onClick={() => setOrganizing((v) => !v)}
          aria-pressed={organizing}
          className={organizing ? `${buttonPrimary} bg-st-done` : buttonSecondary}
        >
          {organizing ? <CheckIcon className="h-4 w-4" /> : <SortIcon className="h-4 w-4" />}
          {organizing ? "Listo" : "Organizar"}
        </button>
        <button
          onClick={() => setEditing(emptyProduct(categoryFilter ?? categories[0]?.id ?? 0))}
          className={`${buttonPrimary} hidden sm:inline-flex`}
        >
          <PlusIcon className="h-4 w-4" />
          Producto
        </button>
      </div>

      <p className="mt-3 text-sm text-ink-2">
        {products.length} productos
        {soldOut ? `, ${soldOut} ${soldOut === 1 ? "agotado" : "agotados"}` : ""}
        {activePromos.length
          ? `, ${activePromos.length} ${activePromos.length === 1 ? "promoción activa" : "promociones activas"}`
          : ""}
        .
      </p>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ id: null, name: "Todo", emoji: null } as const, ...categories].map((c) => {
          const active = categoryFilter === c.id;
          return (
            <button
              key={c.id ?? "all"}
              onClick={() => setCategoryFilter(c.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-ink text-surface" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink"
              }`}
            >
              {c.emoji ? <span className="mr-1.5">{c.emoji}</span> : null}
              {c.name}
            </button>
          );
        })}
      </div>

      {organizing ? (
        <p className="mt-4 rounded-lg bg-st-done-soft px-4 py-2.5 text-sm text-st-done-ink">
          Usa las flechas para cambiar el orden. Así aparece en el menú del cliente.
        </p>
      ) : null}

      <div className="mt-5 space-y-6">
        {sections.length === 0 ? (
          <EmptyState title="No hay productos que coincidan">Prueba con otra palabra o categoría.</EmptyState>
        ) : null}

        {sections.map(({ category, items }) => {
          const catIndex = categories.indexOf(category);
          return (
            <section key={category.id} aria-labelledby={`cat-${category.id}`}>
              <header className="mb-2 flex items-center gap-3 px-1">
                <h2 id={`cat-${category.id}`} className="font-display text-xl font-semibold">
                  {category.emoji ? <span className="mr-2">{category.emoji}</span> : null}
                  {category.name}
                </h2>
                <span className="text-sm text-ink-3 tabular-nums">{items.length}</span>
                {!category.active ? (
                  <span className="rounded-full bg-st-off-soft px-2 py-0.5 text-xs font-semibold text-st-off-ink">
                    Oculta en el menú
                  </span>
                ) : null}
                <span className="flex-1" />
                {organizing ? (
                  <>
                    <button
                      onClick={() => setEditingCategory(category)}
                      className="rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-2 hover:bg-sunken hover:text-ink"
                    >
                      Editar
                    </button>
                    {categoryFilter === null ? (
                      <MoveButtons
                        label={category.name}
                        onUp={catIndex > 0 ? () => moveCategory(category.id, -1) : undefined}
                        onDown={catIndex < categories.length - 1 ? () => moveCategory(category.id, 1) : undefined}
                      />
                    ) : null}
                  </>
                ) : null}
              </header>

              <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface ring-1 ring-line">
                {items.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-ink-2">Esta categoría todavía no tiene productos.</li>
                ) : null}
                {items.map((product, i) => {
                  const promo = activePromos.find((p) => appliesTo(p, product));
                  const discounted = promo ? promoPrice(promo, product.price) : null;
                  return (
                    <li
                      key={product.id}
                      className={`flex items-center gap-3 pl-3 pr-3 sm:pr-4 ${product.available ? "" : "bg-sunken/50"}`}
                    >
                      <button
                        onClick={() => !organizing && setEditing(product)}
                        disabled={organizing}
                        className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
                      >
                        <span
                          className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sunken text-2xl ${
                            product.available ? "" : "grayscale"
                          }`}
                        >
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- miniatura; puede ser una vista previa local
                            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            product.emoji
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={`truncate font-medium ${product.available ? "" : "text-ink-2"}`}>
                              {product.name}
                            </span>
                            {promo ? (
                              <span
                                title={promo.name}
                                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink"
                              >
                                <TagIcon className="h-3 w-3" />
                                {promo.kind === "2x1" ? "2x1" : promo.kind === "percent" ? `−${promo.value}%` : "Oferta"}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block truncate text-sm text-ink-2">{product.description}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-display text-lg font-semibold leading-none tabular-nums">
                            {formatCOP(discounted ?? product.price)}
                          </span>
                          {discounted !== null && discounted !== product.price ? (
                            <span className="mt-0.5 block text-xs text-ink-3 line-through tabular-nums">
                              {formatCOP(product.price)}
                            </span>
                          ) : null}
                        </span>
                        {!organizing ? <ChevronRightIcon className="hidden h-4 w-4 shrink-0 text-ink-3 sm:block" /> : null}
                      </button>

                      {organizing ? (
                        <MoveButtons
                          label={product.name}
                          onUp={i > 0 ? () => moveProduct(product.id, -1) : undefined}
                          onDown={i < items.length - 1 ? () => moveProduct(product.id, 1) : undefined}
                        />
                      ) : (
                        <div className="flex shrink-0 items-center gap-2.5 border-l border-line py-2 pl-3">
                          <span
                            className={`hidden w-[4.5rem] text-right text-xs font-semibold sm:block ${
                              product.available ? "text-st-done-ink" : "text-ink-3"
                            }`}
                          >
                            {product.available ? "Disponible" : "Agotado"}
                          </span>
                          <Switch
                            checked={product.available}
                            onChange={() => toggleAvailable(product.id)}
                            label={`${product.name} disponible`}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {organizing ? (
          <button
            onClick={() => setEditingCategory({ id: 0, name: "", emoji: null, active: true })}
            className={`${buttonSecondary} w-full border-dashed`}
          >
            <PlusIcon className="h-4 w-4" />
            Nueva categoría
          </button>
        ) : null}
      </div>

      {/* En el celular, agregar va en un botón flotante al alcance del pulgar. */}
      {!organizing ? (
        <button
          onClick={() => setEditing(emptyProduct(categoryFilter ?? categories[0]?.id ?? 0))}
          aria-label="Agregar producto"
          className="fixed bottom-tabbar right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-surface shadow-lg shadow-black/20 sm:hidden"
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      ) : null}

      <ProductEditor product={editing} categories={categories} onClose={() => setEditing(null)} />
      <CategoryEditor category={editingCategory} onClose={() => setEditingCategory(null)} />
    </div>
  );
}
