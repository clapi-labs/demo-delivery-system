"use client";

import { useMemo, useState, type ReactNode } from "react";

import { formatCOP } from "@sistema/shared";

import { Panel } from "@/components/Panel";
import { CATEGORIES, DEMO_PRODUCTS, type DemoProduct } from "@/lib/demo-data";

type Draft = {
  name: string;
  description: string;
  category: string;
  price: string;
  available: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  category: CATEGORIES[0],
  price: "",
  available: true,
};

function toDraft(product: DemoProduct): Draft {
  return {
    name: product.name,
    description: product.description,
    category: product.category,
    price: String(product.price),
    available: product.available,
  };
}

export default function CatalogoPage() {
  const [products, setProducts] = useState(DEMO_PRODUCTS);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const filtered = useMemo(
    () => (activeCategory ? products.filter((p) => p.category === activeCategory) : products),
    [products, activeCategory],
  );

  const editing = products.find((p) => p.id === editingId) ?? null;
  const panelOpen = editing !== null || creating;

  const openEdit = (product: DemoProduct) => {
    setDraft(toDraft(product));
    setEditingId(product.id);
    setCreating(false);
  };

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setCreating(true);
    setEditingId(null);
  };

  const closePanel = () => {
    setEditingId(null);
    setCreating(false);
  };

  const toggleAvailable = (id: number) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, available: !p.available } : p)));
  };

  const save = () => {
    const price = Number(draft.price) || 0;
    if (editingId !== null) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? { ...p, name: draft.name, description: draft.description, category: draft.category, price, available: draft.available }
            : p,
        ),
      );
    } else {
      const id = Math.max(0, ...products.map((p) => p.id)) + 1;
      setProducts((prev) => [
        ...prev,
        { id, name: draft.name, description: draft.description, category: draft.category, price, available: draft.available },
      ]);
    }
    closePanel();
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Catálogo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Productos y categorías del menú.</p>
        </div>
        <button
          onClick={openCreate}
          className="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          + Agregar producto
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            activeCategory === null
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Todas
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              activeCategory === c
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 font-medium">Producto</th>
            <th className="py-2 font-medium">Categoría</th>
            <th className="py-2 font-medium">Precio</th>
            <th className="py-2 font-medium">Estado</th>
            <th className="py-2 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((product) => (
            <tr key={product.id} className="border-b border-border last:border-0">
              <td className="py-3">
                <p className="font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.description}</p>
              </td>
              <td className="py-3 text-muted-foreground">{product.category}</td>
              <td className="py-3 tabular-nums">{formatCOP(product.price)}</td>
              <td className="py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    product.available
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                      : "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200"
                  }`}
                >
                  {product.available ? "Disponible" : "Agotado"}
                </span>
              </td>
              <td className="py-3">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => toggleAvailable(product.id)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary"
                  >
                    {product.available ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() => openEdit(product)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary"
                  >
                    Editar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Panel
        open={panelOpen}
        onClose={closePanel}
        title={creating ? "Nuevo producto" : (editing?.name ?? "")}
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={closePanel}
              className="h-9 rounded-md border border-border px-4 text-sm font-medium transition-colors hover:border-primary"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Guardar
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </Field>

          <Field label="Descripción">
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Precio">
              <input
                type="number"
                value={draft.price}
                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              />
            </Field>

            <Field label="Categoría">
              <select
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Imagen">
            <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
              Sin imagen — próximamente
            </div>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.available}
              onChange={(e) => setDraft((d) => ({ ...d, available: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            Disponible
          </label>
        </div>
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
