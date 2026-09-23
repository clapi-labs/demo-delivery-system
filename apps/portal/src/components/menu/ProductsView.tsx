"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

import { formatCOP, normalize } from "@sistema/shared";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SortIcon,
  TagIcon,
} from "@/components/icons";
import { useMenu } from "@/components/providers/MenuProvider";
import { EmptyState, Pill, SearchField, Switch, buttonPrimary, buttonSecondary } from "@/components/ui";
import { appliesTo, promoPrice, type MenuCategory, type MenuProduct, type Promotion } from "@/lib/menu";

import { MenuSymbol } from "./MenuSymbol";
import { CategoryEditor, ProductEditor, emptyProduct } from "./ProductEditor";

function MoveButtons({
  onBack,
  onForward,
  label,
  axis,
}: {
  onBack?: () => void;
  onForward?: () => void;
  label: string;
  /** Vertical para categorías (una debajo de otra), horizontal para la cuadrícula. */
  axis: "vertical" | "horizontal";
}) {
  const Back = axis === "vertical" ? ArrowUpIcon : ChevronLeftIcon;
  const Forward = axis === "vertical" ? ArrowDownIcon : ChevronRightIcon;
  const cls =
    "ease-ui rounded-lg bg-surface p-2 text-ink-2 shadow-sm ring-1 ring-black/10 hover:text-ink disabled:opacity-30 disabled:shadow-none";
  return (
    <div className="flex shrink-0 gap-1">
      <button onClick={onBack} disabled={!onBack} aria-label={`Mover ${label} antes`} className={cls}>
        <Back className="h-4 w-4" />
      </button>
      <button onClick={onForward} disabled={!onForward} aria-label={`Mover ${label} después`} className={cls}>
        <Forward className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProductCard({
  product,
  category,
  promo,
  organizing,
  onEdit,
  onToggle,
  onBack,
  onForward,
}: {
  product: MenuProduct;
  category: MenuCategory;
  promo: Promotion | undefined;
  organizing: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onBack?: () => void;
  onForward?: () => void;
}) {
  const discounted = promo ? promoPrice(promo, product.price) : null;
  const soldOut = !product.available;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="card flex flex-col overflow-hidden transition-shadow duration-200 ease-in-out hover:shadow-md"
    >
      <button
        onClick={onEdit}
        disabled={organizing}
        aria-label={`Editar ${product.name}`}
        className="group relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-sunken"
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura; puede ser una vista previa local
          <img
            src={product.imageUrl}
            alt=""
            className={`ease-ui h-full w-full object-cover group-hover:scale-[1.03] ${soldOut ? "grayscale" : ""}`}
          />
        ) : (
          <MenuSymbol
            name={category.symbol}
            className={`ease-ui h-10 w-10 group-hover:scale-110 ${soldOut ? "text-idle" : "text-ink-3"}`}
          />
        )}
        <span className="absolute left-2 top-2 flex flex-wrap gap-1">
          {promo ? (
            <Pill tone="brand" className="shadow-sm">
              <TagIcon className="h-3 w-3" />
              {promo.kind === "2x1" ? "2x1" : promo.kind === "percent" ? `−${promo.value}%` : "Oferta"}
            </Pill>
          ) : null}
        </span>
        {soldOut ? (
          <span className="absolute right-2 top-2">
            <Pill tone="idle" className="shadow-sm ring-1 ring-black/5">
              Agotado
            </Pill>
          </span>
        ) : null}
      </button>

      <button onClick={onEdit} disabled={organizing} className="flex flex-1 flex-col p-3.5 text-left">
        <span className={`line-clamp-1 text-sm font-semibold tracking-title ${soldOut ? "text-ink-2" : ""}`}>
          {product.name}
        </span>
        <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-3">{product.description}</span>
        <span className="mt-auto flex items-baseline gap-1.5 pt-2.5">
          <span className="font-semibold tabular-nums">{formatCOP(discounted ?? product.price)}</span>
          {discounted !== null && discounted !== product.price ? (
            <span className="text-xs tabular-nums text-ink-3 line-through">{formatCOP(product.price)}</span>
          ) : null}
        </span>
      </button>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3.5 py-2.5">
        {organizing ? (
          <>
            <span className="text-xs text-ink-3">Orden</span>
            <MoveButtons axis="horizontal" label={product.name} onBack={onBack} onForward={onForward} />
          </>
        ) : (
          <>
            <span className={`text-xs font-medium ${soldOut ? "text-idle-ink" : "text-ok-ink"}`}>
              {soldOut ? "Agotado" : "Disponible"}
            </span>
            <Switch checked={product.available} onChange={onToggle} label={`${product.name} disponible`} size="sm" />
          </>
        )}
      </div>
    </motion.li>
  );
}

/**
 * Los productos en cuadrícula, agrupados como los ve el cliente. Lo más
 * frecuente —marcar algo como agotado— es un interruptor en la misma tarjeta,
 * sin abrir nada. Editar es tocar la tarjeta. Reordenar vive en un modo aparte
 * para que no estorbe el resto del tiempo.
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
        <SearchField value={query} onChange={setQuery} placeholder="Buscar producto" className="min-w-0 flex-1 sm:max-w-xs" />
        <button
          onClick={() => setOrganizing((v) => !v)}
          aria-pressed={organizing}
          className={organizing ? `${buttonPrimary} bg-ok hover:bg-ok` : buttonSecondary}
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

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <Pill tone="ok">{products.length - soldOut} disponibles</Pill>
        {soldOut ? <Pill tone="idle">{soldOut} agotados</Pill> : null}
        {activePromos.length ? (
          <Pill tone="brand">
            {activePromos.length} {activePromos.length === 1 ? "promoción activa" : "promociones activas"}
          </Pill>
        ) : null}
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ id: null, name: "Todo", symbol: null } as const, ...categories].map((c) => {
          const active = categoryFilter === c.id;
          return (
            <button
              key={c.id ?? "all"}
              onClick={() => setCategoryFilter(c.id)}
              className={`ease-ui inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium shadow-sm ${
                active ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-black/5 hover:text-ink"
              }`}
            >
              {c.symbol ? <MenuSymbol name={c.symbol} className="h-4 w-4" /> : null}
              {c.name}
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {organizing ? (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <span className="mt-4 block rounded-xl bg-ok-soft px-4 py-2.5 text-sm text-ok-ink">
              Usa las flechas para cambiar el orden. Así aparece en el menú del cliente.
            </span>
          </motion.p>
        ) : null}
      </AnimatePresence>

      <div className="mt-6 space-y-8">
        {sections.length === 0 ? (
          <EmptyState title="No hay productos que coincidan">Prueba con otra palabra o categoría.</EmptyState>
        ) : null}

        {sections.map(({ category, items }) => {
          const catIndex = categories.indexOf(category);
          return (
            <motion.section layout key={category.id} aria-labelledby={`cat-${category.id}`}>
              <header className="mb-3 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink-2 shadow-sm ring-1 ring-black/5">
                  <MenuSymbol name={category.symbol} className="h-4 w-4" />
                </span>
                <h2 id={`cat-${category.id}`} className="font-semibold tracking-title">
                  {category.name}
                </h2>
                <span className="text-sm tabular-nums text-ink-3">{items.length}</span>
                {!category.active ? <Pill tone="idle">Oculta en el menú</Pill> : null}
                <span className="flex-1" />
                {organizing ? (
                  <>
                    <button
                      onClick={() => setEditingCategory(category)}
                      className="ease-ui rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface hover:text-ink"
                    >
                      Editar
                    </button>
                    {categoryFilter === null ? (
                      <MoveButtons
                        axis="vertical"
                        label={category.name}
                        onBack={catIndex > 0 ? () => moveCategory(category.id, -1) : undefined}
                        onForward={catIndex < categories.length - 1 ? () => moveCategory(category.id, 1) : undefined}
                      />
                    ) : null}
                  </>
                ) : null}
              </header>

              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-3">
                  Esta categoría todavía no tiene productos.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  <AnimatePresence initial={false} mode="popLayout">
                    {items.map((product, i) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        category={category}
                        promo={activePromos.find((p) => appliesTo(p, product))}
                        organizing={organizing}
                        onEdit={() => setEditing(product)}
                        onToggle={() => toggleAvailable(product.id)}
                        onBack={i > 0 ? () => moveProduct(product.id, -1) : undefined}
                        onForward={i < items.length - 1 ? () => moveProduct(product.id, 1) : undefined}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </motion.section>
          );
        })}

        {organizing ? (
          <button
            onClick={() => setEditingCategory({ id: 0, name: "", symbol: "plate", active: true })}
            className={`${buttonSecondary} w-full border border-dashed border-line-strong shadow-none ring-0`}
          >
            <PlusIcon className="h-4 w-4" />
            Nueva categoría
          </button>
        ) : null}
      </div>

      {/* En el celular, agregar va en un botón flotante al alcance del pulgar. */}
      {!organizing ? (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setEditing(emptyProduct(categoryFilter ?? categories[0]?.id ?? 0))}
          aria-label="Agregar producto"
          className="fixed bottom-tabbar right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 sm:hidden"
        >
          <PlusIcon className="h-6 w-6" />
        </motion.button>
      ) : null}

      <ProductEditor product={editing} categories={categories} onClose={() => setEditing(null)} />
      <CategoryEditor category={editingCategory} onClose={() => setEditingCategory(null)} />
    </div>
  );
}
