"use client";

import { useState } from "react";

import { formatCOP } from "@sistema/shared";

import { ChevronRightIcon, PlusIcon, TagIcon, TrashIcon } from "@/components/icons";
import { useMenu } from "@/components/providers/MenuProvider";
import { Sheet } from "@/components/Sheet";
import {
  EmptyState,
  Field,
  Segmented,
  Switch,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/ui";
import {
  DAY_LETTERS,
  appliesTo,
  promoPrice,
  promoValueLabel,
  scheduleLabel,
  type MenuCategory,
  type MenuProduct,
  type Promotion,
  type PromotionKind,
} from "@/lib/menu";

import { MenuSymbol } from "./MenuSymbol";
import { PriceInput } from "./ProductEditor";

function scopeLabel(promo: Promotion, categories: MenuCategory[], products: MenuProduct[]) {
  if (promo.scope.type === "all") return "Todo el menú";
  const ids = promo.scope.ids;
  const names =
    promo.scope.type === "category"
      ? categories.filter((c) => ids.includes(c.id)).map((c) => c.name)
      : products.filter((p) => ids.includes(p.id)).map((p) => p.name);
  if (names.length === 0) return "Sin productos elegidos";
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} y ${names.length - 2} más` : names.join(" y ");
}

const EMPTY_PROMO: Promotion = {
  id: 0,
  name: "",
  kind: "percent",
  value: 10,
  scope: { type: "category", ids: [] },
  days: [0, 1, 2, 3, 4, 5, 6],
  from: null,
  to: null,
  active: true,
};

/** Días en orden de lunes a domingo, que es como se piensa una semana. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

function PromotionEditor({ promotion, onClose }: { promotion: Promotion | null; onClose: () => void }) {
  const { categories, products, savePromotion, deletePromotion } = useMenu();
  const [draft, setDraft] = useState(promotion);
  const [last, setLast] = useState(promotion);
  if (promotion !== last) {
    setLast(promotion);
    if (promotion) setDraft(promotion);
  }

  if (!draft) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;

  const set = (patch: Partial<Promotion>) => setDraft({ ...draft, ...patch });
  const scopeIds = draft.scope.type === "all" ? [] : draft.scope.ids;
  const toggleId = (id: number) =>
    set({
      scope: {
        type: draft.scope.type === "products" ? "products" : "category",
        ids: scopeIds.includes(id) ? scopeIds.filter((x) => x !== id) : [...scopeIds, id],
      },
    });

  const affected = products.filter((p) => appliesTo(draft, p));
  const example = affected[0];
  const allDay = draft.from === null;
  const valid =
    draft.name.trim().length > 0 &&
    draft.days.length > 0 &&
    (draft.scope.type === "all" || draft.scope.ids.length > 0) &&
    (draft.kind === "2x1" || draft.value > 0) &&
    (draft.kind !== "percent" || draft.value < 100);

  return (
    <Sheet
      open={promotion !== null}
      onClose={onClose}
      title={draft.id === 0 ? "Nueva promoción" : "Editar promoción"}
      footer={
        <div className="flex items-center gap-2">
          {draft.id !== 0 ? (
            <button
              onClick={() => {
                deletePromotion(draft.id);
                onClose();
              }}
              aria-label="Eliminar promoción"
              className="mr-auto rounded-lg p-2.5 text-ink-3 hover:bg-danger-soft hover:text-danger"
            >
              <TrashIcon />
            </button>
          ) : (
            <span className="mr-auto" />
          )}
          <button onClick={onClose} className={buttonSecondary}>
            Cancelar
          </button>
          <button
            disabled={!valid}
            onClick={() => {
              savePromotion({ ...draft, name: draft.name.trim() });
              onClose();
            }}
            className={buttonPrimary}
          >
            {draft.id === 0 ? "Crear promoción" : "Guardar"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <Field label="Nombre" hint="Para reconocerla aquí. El cliente ve el precio con descuento.">
          <input
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Ej. Hora feliz de hamburguesas"
            className={inputClass}
          />
        </Field>

        <div>
          <p className="text-sm font-medium">Tipo de descuento</p>
          <Segmented<PromotionKind>
            value={draft.kind}
            onChange={(kind) => set({ kind, value: kind === "percent" ? 10 : kind === "price" ? 0 : 0 })}
            options={[
              { value: "percent", label: "Porcentaje" },
              { value: "price", label: "Precio fijo" },
              { value: "2x1", label: "2x1" },
            ]}
            className="mt-1.5"
          />
          {draft.kind === "percent" ? (
            <div className="mt-3 flex items-center gap-3">
              <input
                inputMode="numeric"
                value={draft.value || ""}
                onChange={(e) => set({ value: Math.min(99, Number(e.target.value.replace(/\D/g, "")) || 0) })}
                aria-label="Porcentaje de descuento"
                className={`${inputClass} w-24 text-center font-display text-xl font-semibold`}
              />
              <span className="text-sm text-ink-2">% menos sobre el precio normal</span>
            </div>
          ) : draft.kind === "price" ? (
            <div className="mt-3">
              <PriceInput value={draft.value} onChange={(value) => set({ value })} />
              <p className="mt-1 text-xs text-ink-3">El producto se vende a este precio mientras dure la promoción.</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-2">El cliente lleva dos y paga uno.</p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium">Aplica a</p>
          <Segmented<Promotion["scope"]["type"]>
            value={draft.scope.type}
            onChange={(type) => set({ scope: type === "all" ? { type } : { type, ids: [] } })}
            options={[
              { value: "category", label: "Categorías" },
              { value: "products", label: "Productos" },
              { value: "all", label: "Todo" },
            ]}
            className="mt-1.5"
          />
          {draft.scope.type !== "all" ? (
            <div className="mt-3 max-h-56 overflow-y-auto rounded-lg ring-1 ring-line">
              {(draft.scope.type === "category" ? categories : products).map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2.5 text-sm last:border-0 hover:bg-sunken"
                >
                  <input
                    type="checkbox"
                    checked={scopeIds.includes(item.id)}
                    onChange={() => toggleId(item.id)}
                    className="h-4 w-4 accent-[var(--ink)]"
                  />
                  <MenuSymbol
                    name={
                      "symbol" in item
                        ? item.symbol
                        : (categories.find((c) => c.id === item.categoryId)?.symbol ?? "plate")
                    }
                    className="h-5 w-5 shrink-0 text-ink-2"
                  />
                  <span className="flex-1">{item.name}</span>
                  {"price" in item ? <span className="text-ink-3 tabular-nums">{formatCOP(item.price)}</span> : null}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-medium">Cuándo</p>
          <div className="mt-2 flex gap-1.5" role="group" aria-label="Días de la semana">
            {WEEK.map((d) => {
              const on = draft.days.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => set({ days: on ? draft.days.filter((x) => x !== d) : [...draft.days, d] })}
                  aria-pressed={on}
                  className={`h-10 flex-1 rounded-lg text-sm font-semibold transition-colors ${
                    on ? "bg-ink text-surface" : "bg-sunken text-ink-2 hover:text-ink"
                  }`}
                >
                  {DAY_LETTERS[d]}
                </button>
              );
            })}
          </div>
          <label className="mt-3 flex items-center justify-between gap-4 text-sm">
            <span>Todo el día</span>
            <Switch
              size="sm"
              checked={allDay}
              onChange={(v) => set(v ? { from: null, to: null } : { from: "15:00", to: "18:00" })}
              label="Todo el día"
            />
          </label>
          {!allDay ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Desde">
                <input
                  type="time"
                  value={draft.from ?? ""}
                  onChange={(e) => set({ from: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Hasta">
                <input
                  type="time"
                  value={draft.to ?? ""}
                  onChange={(e) => set({ to: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
          ) : null}
        </div>

        {example ? (
          <div className="rounded-lg bg-brand-soft px-4 py-3 text-sm">
            <p className="font-medium">Así lo ve el cliente</p>
            <p className="mt-1 text-ink-2">
              {example.name}:{" "}
              {draft.kind === "2x1" ? (
                <span className="font-semibold text-ink">2 por {formatCOP(example.price)}</span>
              ) : (
                <>
                  <span className="line-through">{formatCOP(example.price)}</span>{" "}
                  <span className="font-semibold text-ink">{formatCOP(promoPrice(draft, example.price) ?? example.price)}</span>
                </>
              )}
              {affected.length > 1 ? `, y ${affected.length - 1} productos más.` : "."}
            </p>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

export function PromotionsView() {
  const { promotions, categories, products, togglePromotion } = useMenu();
  const [editing, setEditing] = useState<Promotion | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          Descuentos por horario o por día. El menú del cliente los aplica solo mientras estén activos.
        </p>
        <button onClick={() => setEditing(EMPTY_PROMO)} className={`${buttonPrimary} shrink-0`}>
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Nueva promoción</span>
          <span className="sm:hidden">Nueva</span>
        </button>
      </div>

      {promotions.length === 0 ? (
        <div className="mt-5">
          <EmptyState title="No hay promociones">Crea una para mover los productos en horas flojas.</EmptyState>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {promotions.map((promo) => (
            <li
              key={promo.id}
              className={`flex items-stretch overflow-hidden rounded-lg bg-surface ring-1 ring-line ${promo.active ? "" : "opacity-70"}`}
            >
              <button onClick={() => setEditing(promo)} className="flex min-w-0 flex-1 items-start gap-3 p-4 text-left">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    promo.active ? "bg-brand-soft text-brand-ink" : "bg-sunken text-ink-3"
                  }`}
                >
                  <TagIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{promo.name}</span>
                  <span className="mt-0.5 block font-display text-lg font-semibold leading-tight text-brand-ink">
                    {promoValueLabel(promo)}
                  </span>
                  <span className="mt-1 block truncate text-sm text-ink-2">
                    {scopeLabel(promo, categories, products)}
                  </span>
                  <span className="block truncate text-sm text-ink-2">{scheduleLabel(promo)}</span>
                </span>
                <ChevronRightIcon className="mt-2.5 h-4 w-4 shrink-0 text-ink-3" />
              </button>
              <div className="flex flex-col items-center justify-center gap-1 border-l border-line px-4">
                <Switch
                  checked={promo.active}
                  onChange={() => togglePromotion(promo.id)}
                  label={`${promo.name} activa`}
                />
                <span className="text-xs text-ink-3">{promo.active ? "Activa" : "Pausada"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PromotionEditor promotion={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
