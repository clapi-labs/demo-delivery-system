"use client";

import Image from "next/image";
import { useState, type ChangeEvent } from "react";

import { formatCOP } from "@sistema/shared";

import { CloseIcon, ImageIcon, PlusIcon, TagIcon, TrashIcon } from "@/components/icons";
import { useMenu } from "@/components/providers/MenuProvider";
import { categoryImage } from "@/lib/category-images";

import { MenuSymbol } from "./MenuSymbol";
import { Sheet } from "@/components/Sheet";
import { Field, Switch, buttonPrimary, buttonSecondary, inputClass } from "@/components/ui";
import {
  MENU_SYMBOLS,
  appliesTo,
  promoValueLabel,
  scheduleLabel,
  type MenuCategory,
  type MenuOptionGroup,
  type MenuProduct,
} from "@/lib/menu";

/** Un precio escrito como "18.000" o "18000": solo cuentan los dígitos. */
export function PriceInput({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  id?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">$</span>
      <input
        id={id}
        inputMode="numeric"
        value={value ? value.toLocaleString("es-CO") : ""}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        placeholder="0"
        className={`${inputClass} pl-7 tabular-nums`}
      />
    </div>
  );
}

let tempId = -1;

function OptionGroupsEditor({
  groups,
  onChange,
}: {
  groups: MenuOptionGroup[];
  onChange: (groups: MenuOptionGroup[]) => void;
}) {
  const updateGroup = (id: number, patch: Partial<MenuOptionGroup>) =>
    onChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.id} className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line p-2">
            <input
              value={group.name}
              onChange={(e) => updateGroup(group.id, { name: e.target.value })}
              placeholder="Nombre del grupo, ej. Extras"
              aria-label="Nombre del grupo"
              className="h-10 min-w-0 flex-1 rounded-md px-2 text-base font-medium outline-none focus:bg-sunken can-hover:h-9 can-hover:text-sm"
            />
            <button
              onClick={() => onChange(groups.filter((g) => g.id !== group.id))}
              aria-label={`Quitar el grupo ${group.name}`}
              className="rounded-md p-2 text-ink-3 hover:bg-danger-soft hover:text-danger"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3 py-2 text-sm">
            <select
              value={group.type}
              onChange={(e) => updateGroup(group.id, { type: e.target.value as MenuOptionGroup["type"] })}
              aria-label="Cuántas opciones puede elegir"
              className="h-8 rounded-md border border-line bg-surface px-2 text-sm"
            >
              <option value="single">Elige una</option>
              <option value="multi">Elige varias</option>
            </select>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={group.required}
                onChange={(e) => updateGroup(group.id, { required: e.target.checked })}
                className="h-4 w-4 accent-[var(--ink)]"
              />
              Obligatorio
            </label>
          </div>

          <ul className="divide-y divide-line">
            {group.options.map((option) => (
              <li key={option.id} className="flex items-center gap-2 px-2 py-1.5">
                <input
                  value={option.name}
                  onChange={(e) =>
                    updateGroup(group.id, {
                      options: group.options.map((o) => (o.id === option.id ? { ...o, name: e.target.value } : o)),
                    })
                  }
                  placeholder="Opción"
                  aria-label="Nombre de la opción"
                  className="h-10 min-w-0 flex-1 rounded-md px-2 text-base outline-none focus:bg-sunken can-hover:h-9 can-hover:text-sm"
                />
                <div className="relative w-28 shrink-0">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-ink-3">
                    + $
                  </span>
                  <input
                    inputMode="numeric"
                    value={option.priceDelta ? option.priceDelta.toLocaleString("es-CO") : ""}
                    onChange={(e) =>
                      updateGroup(group.id, {
                        options: group.options.map((o) =>
                          o.id === option.id ? { ...o, priceDelta: Number(e.target.value.replace(/\D/g, "")) || 0 } : o,
                        ),
                      })
                    }
                    placeholder="0"
                    aria-label="Precio adicional"
                    className="h-10 w-full rounded-md border border-line pl-8 pr-2 text-right text-base tabular-nums outline-none focus:border-ink-3 can-hover:h-9 can-hover:text-sm"
                  />
                </div>
                <button
                  onClick={() =>
                    updateGroup(group.id, { options: group.options.filter((o) => o.id !== option.id) })
                  }
                  aria-label={`Quitar ${option.name}`}
                  className="rounded-md p-2 text-ink-3 hover:bg-sunken hover:text-ink"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() =>
              updateGroup(group.id, { options: [...group.options, { id: tempId--, name: "", priceDelta: 0 }] })
            }
            className="flex w-full items-center gap-1.5 border-t border-line px-3 py-2 text-sm font-medium text-ink-2 hover:bg-sunken hover:text-ink"
          >
            <PlusIcon className="h-4 w-4" />
            Agregar opción
          </button>
        </div>
      ))}

      <button
        onClick={() =>
          onChange([
            ...groups,
            { id: tempId--, name: "", type: "single", required: false, options: [{ id: tempId--, name: "", priceDelta: 0 }] },
          ])
        }
        className={`${buttonSecondary} w-full border-dashed`}
      >
        <PlusIcon className="h-4 w-4" />
        Agregar grupo de opciones
      </button>
    </div>
  );
}

export function emptyProduct(categoryId: number): MenuProduct {
  return {
    id: 0,
    categoryId,
    name: "",
    description: "",
    price: 0,
    imageUrl: null,
    available: true,
    optionGroups: [],
  };
}

/**
 * Crear o editar un producto. Todo en una hoja: lo común arriba (foto,
 * nombre, precio), lo que se toca menos (opciones) abajo.
 */
export function ProductEditor({
  product,
  categories,
  onClose,
}: {
  /** `null` = cerrado; `id === 0` = producto nuevo. */
  product: MenuProduct | null;
  categories: MenuCategory[];
  onClose: () => void;
}) {
  const { saveProduct, deleteProduct, promotions, editingSaves } = useMenu();
  const [draft, setDraft] = useState<MenuProduct | null>(product);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastProduct, setLastProduct] = useState(product);

  // Al abrir otro producto se reinicia el borrador (patrón de React para
  // derivar estado de una prop sin un efecto). Al cerrar se conserva, para
  // que la hoja no se vacíe mientras se desliza hacia afuera.
  if (product !== lastProduct) {
    setLastProduct(product);
    if (product) {
      setDraft(product);
      setImage(null);
      setPreview(null);
      setConfirmDelete(false);
    }
  }

  const onImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    // La vista previa es local (blob:). No se revoca: el producto guardado la
    // sigue mostrando hasta que el backend devuelva la URL real de la foto.
    setPreview(URL.createObjectURL(file));
  };

  const set = (patch: Partial<MenuProduct>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const isNew = draft?.id === 0;
  const valid = !!draft && draft.name.trim().length > 0 && draft.price > 0;
  const activePromos = draft ? promotions.filter((p) => p.active && appliesTo(p, draft)) : [];
  const imageSrc = preview ?? draft?.imageUrl ?? null;
  const category = categories.find((c) => c.id === draft?.categoryId);

  const save = () => {
    if (!draft || !valid) return;
    saveProduct(
      {
        ...draft,
        name: draft.name.trim(),
        imageUrl: preview ?? draft.imageUrl,
        // Grupos u opciones sin nombre no significan nada para el cliente.
        optionGroups: draft.optionGroups
          .filter((g) => g.name.trim())
          .map((g) => ({ ...g, options: g.options.filter((o) => o.name.trim()) })),
      },
      image,
    );
    onClose();
  };

  return (
    <Sheet
      open={product !== null}
      onClose={onClose}
      title={isNew ? "Nuevo producto" : (draft?.name || "Producto")}
      subtitle={isNew && editingSaves ? "Aparece en el menú apenas lo guardes." : undefined}
      footer={
        confirmDelete && draft ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm font-medium text-danger">¿Eliminar {draft.name} del menú?</p>
            <button onClick={() => setConfirmDelete(false)} className={buttonSecondary}>
              No
            </button>
            <button
              onClick={() => {
                deleteProduct(draft.id);
                onClose();
              }}
              className={`${buttonPrimary} bg-danger`}
            >
              Sí, eliminar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {!isNew ? (
              <button
                onClick={() => setConfirmDelete(true)}
                aria-label="Eliminar producto"
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
            <button onClick={save} disabled={!valid} className={buttonPrimary}>
              {isNew ? "Agregar al menú" : "Guardar cambios"}
            </button>
          </div>
        )
      }
    >
      {draft ? (
        <div className="space-y-5">
          {/* Decirlo en vez de fingir: editar un producto todavía no escribe
              en la base (falta dónde guardar la foto), y alguien grabando una
              demo tiene que saberlo antes de cambiar un precio en cámara. */}
          {!editingSaves ? (
            <p className="rounded-xl bg-idle-soft px-4 py-3 text-sm text-idle-ink">
              Los cambios de producto todavía no se guardan: se ven en esta pantalla hasta que recargues. Marcar
              agotado y las promociones sí quedan guardados.
            </p>
          ) : null}

          <label className="group relative flex h-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-sunken ring-1 ring-black/5">
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por el optimizador
              <img src={imageSrc} alt="" className="h-full w-full object-cover" />
            ) : category ? (
              <Image src={categoryImage(category.slug)} alt="" placeholder="blur" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-8 w-8 text-ink-3" />
            )}
            <span className="ease-ui absolute bottom-2 right-2 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-black/5 group-hover:bg-surface">
              {imageSrc ? "Cambiar foto" : "Subir foto"}
            </span>
            <input type="file" accept="image/*" onChange={onImage} className="sr-only" />
          </label>

          <Field label="Nombre">
            <input
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Ej. Hamburguesa Clásica"
              className={inputClass}
            />
          </Field>

          <Field label="Descripción" hint="Lo que lleva. Es lo que lee el cliente en el menú.">
            <textarea
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
              className={`${inputClass} h-auto resize-none py-2.5`}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio">
              <PriceInput value={draft.price} onChange={(price) => set({ price })} />
            </Field>
            <Field label="Categoría">
              <select
                value={draft.categoryId}
                onChange={(e) => set({ categoryId: Number(e.target.value) })}
                className={inputClass}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-sunken px-4 py-3">
            <div>
              <p className="text-sm font-medium">{draft.available ? "Disponible" : "Agotado"}</p>
              <p className="text-xs text-ink-2">
                {draft.available ? "Los clientes lo pueden pedir." : "Se ve en el menú, pero no se puede pedir."}
              </p>
            </div>
            <Switch checked={draft.available} onChange={(available) => set({ available })} label="Disponible" />
          </div>

          {activePromos.length > 0 ? (
            <section>
              <h3 className="text-sm font-medium">Promociones que lo incluyen</h3>
              <ul className="mt-2 space-y-1.5">
                {activePromos.map((p) => (
                  <li key={p.id} className="flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2 text-sm">
                    <TagIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" />
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="block text-xs text-ink-2">
                        {promoValueLabel(p)}, {scheduleLabel(p).toLowerCase()}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h3 className="text-sm font-medium">Opciones para personalizar</h3>
            <p className="mb-3 mt-0.5 text-xs text-ink-2">
              Término, extras, acompañamiento. Cada opción puede sumar al precio
              {draft.price ? `, que parte de ${formatCOP(draft.price)}` : ""}.
            </p>
            <OptionGroupsEditor groups={draft.optionGroups} onChange={(optionGroups) => set({ optionGroups })} />
          </section>
        </div>
      ) : null}
    </Sheet>
  );
}

/** Crear o renombrar una categoría. */
export function CategoryEditor({
  category,
  onClose,
}: {
  category: MenuCategory | null;
  onClose: () => void;
}) {
  const { saveCategory } = useMenu();
  const [draft, setDraft] = useState(category);
  const [last, setLast] = useState(category);
  if (category !== last) {
    setLast(category);
    if (category) setDraft(category);
  }
  const valid = !!draft?.name.trim();

  return (
    <Sheet
      open={category !== null}
      onClose={onClose}
      title={category?.id === 0 ? "Nueva categoría" : "Editar categoría"}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={buttonSecondary}>
            Cancelar
          </button>
          <button
            disabled={!valid}
            onClick={() => {
              if (draft && valid) saveCategory({ ...draft, name: draft.name.trim() });
              onClose();
            }}
            className={buttonPrimary}
          >
            Guardar
          </button>
        </div>
      }
    >
      {draft ? (
        <div className="space-y-5">
          <Field label="Nombre">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ej. Hamburguesas"
              className={inputClass}
            />
          </Field>
          <div>
            <p className="text-sm font-medium">Símbolo</p>
            <div className="mt-1.5 grid grid-cols-5 gap-2 sm:grid-cols-9" role="radiogroup" aria-label="Símbolo">
              {MENU_SYMBOLS.map((s) => {
                const selected = draft.symbol === s.name;
                return (
                  <button
                    key={s.name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={s.label}
                    title={s.label}
                    onClick={() => setDraft({ ...draft, symbol: s.name })}
                    className={`flex aspect-square items-center justify-center rounded-lg transition-colors ${
                      selected ? "bg-ink text-surface" : "bg-sunken text-ink-2 hover:text-ink"
                    }`}
                  >
                    <MenuSymbol name={s.name} className="h-6 w-6" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-sunken px-4 py-3">
            <div>
              <p className="text-sm font-medium">Visible en el menú</p>
              <p className="text-xs text-ink-2">Si la ocultas, sus productos tampoco se ven.</p>
            </div>
            <Switch
              checked={draft.active}
              onChange={(active) => setDraft({ ...draft, active })}
              label="Visible en el menú"
            />
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
