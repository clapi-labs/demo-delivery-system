"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { demoMenu, demoPromotions } from "@/lib/demo-data";
import type { MenuCategory, MenuProduct, Promotion } from "@/lib/menu";
import * as api from "@/lib/portal-api";

import { useToast } from "./ToastProvider";

/**
 * El menú que administra el restaurante, en el layout para que los cambios
 * sobrevivan a navegar entre pantallas (y el Inicio sepa cuántos agotados hay).
 *
 * TODO(backend): cargar con `getCatalog()` (ya existe en
 * `packages/shared/src/db/queries/catalog.ts`) y las promociones cuando
 * tengan tabla. Las escrituras ya pasan por `src/lib/portal-api.ts`.
 */

type MenuContext = {
  categories: MenuCategory[];
  products: MenuProduct[];
  promotions: Promotion[];
  toggleAvailable: (productId: number) => void;
  saveProduct: (product: MenuProduct, image?: File | null) => void;
  deleteProduct: (productId: number) => void;
  moveProduct: (productId: number, direction: -1 | 1) => void;
  moveCategory: (categoryId: number, direction: -1 | 1) => void;
  saveCategory: (category: MenuCategory) => void;
  savePromotion: (promotion: Promotion) => void;
  togglePromotion: (promotionId: number) => void;
  deletePromotion: (promotionId: number) => void;
};

const Context = createContext<MenuContext | null>(null);

export function useMenu() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useMenu fuera de MenuProvider");
  return ctx;
}

const nextId = (items: { id: number }[]) => Math.max(0, ...items.map((i) => i.id)) + 1;

function swap<T>(list: T[], i: number, j: number) {
  if (j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export function MenuProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [initial] = useState(demoMenu);
  const [categories, setCategories] = useState(initial.categories);
  const [products, setProducts] = useState(initial.products);
  const [promotions, setPromotions] = useState(demoPromotions);

  const failed = useCallback(
    (what: string) => toast({ message: `No se pudo guardar: ${what}`, description: "Inténtalo de nuevo." }),
    [toast],
  );

  const applyAvailable = useCallback(
    (productId: number, available: boolean) => {
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, available } : p)));
      api.setProductAvailable(productId, available).catch(() => {
        setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, available: !available } : p)));
        failed("la disponibilidad");
      });
    },
    [failed],
  );

  const toggleAvailable = useCallback(
    (productId: number) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      const available = !product.available;
      applyAvailable(productId, available);
      toast({
        message: available ? `${product.name} está disponible` : `${product.name} quedó agotado`,
        description: available ? "Ya se puede pedir desde el menú." : "El menú lo muestra como agotado.",
        action: { label: "Deshacer", onClick: () => applyAvailable(productId, !available) },
      });
    },
    [products, applyAvailable, toast],
  );

  const saveProduct = useCallback(
    (product: MenuProduct, image?: File | null) => {
      const isNew = product.id === 0;
      const saved = isNew ? { ...product, id: nextId(products) } : product;
      setProducts((prev) => (isNew ? [...prev, saved] : prev.map((p) => (p.id === saved.id ? saved : p))));
      toast({ message: isNew ? `${saved.name} se agregó al menú` : "Cambios guardados" });
      api.saveProduct(saved, image).catch(() => failed(saved.name));
    },
    [products, toast, failed],
  );

  const deleteProduct = useCallback(
    (productId: number) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      toast({
        message: `${product.name} se eliminó`,
        action: {
          label: "Deshacer",
          onClick: () => {
            setProducts((prev) => [...prev, product]);
            api.saveProduct(product).catch(() => failed(product.name));
          },
        },
      });
      api.deleteProduct(productId).catch(() => failed(product.name));
    },
    [products, toast, failed],
  );

  const moveProduct = useCallback(
    (productId: number, direction: -1 | 1) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      // Se reordena solo dentro de la categoría: el orden del arreglo es el
      // `sort_order` de cada producto.
      const siblings = products.filter((p) => p.categoryId === product.categoryId);
      const target = siblings[siblings.indexOf(product) + direction];
      if (!target) return;
      const next = swap(products, products.indexOf(product), products.indexOf(target));
      setProducts(next);
      api
        .saveProductOrder(next.filter((p) => p.categoryId === product.categoryId).map((p) => p.id))
        .catch(() => failed("el orden"));
    },
    [products, failed],
  );

  const moveCategory = useCallback(
    (categoryId: number, direction: -1 | 1) => {
      const i = categories.findIndex((c) => c.id === categoryId);
      const next = swap(categories, i, i + direction);
      setCategories(next);
      api.saveCategories(next).catch(() => failed("el orden"));
    },
    [categories, failed],
  );

  const saveCategory = useCallback(
    (category: MenuCategory) => {
      const next =
        category.id === 0
          ? [...categories, { ...category, id: nextId(categories) }]
          : categories.map((c) => (c.id === category.id ? category : c));
      setCategories(next);
      api.saveCategories(next).catch(() => failed(category.name));
    },
    [categories, failed],
  );

  const savePromotion = useCallback(
    (promotion: Promotion) => {
      const isNew = promotion.id === 0;
      const saved = isNew ? { ...promotion, id: nextId(promotions) } : promotion;
      setPromotions((prev) => (isNew ? [saved, ...prev] : prev.map((p) => (p.id === saved.id ? saved : p))));
      toast({ message: isNew ? "Promoción creada" : "Promoción guardada" });
      api.savePromotion(saved).catch(() => failed(saved.name));
    },
    [promotions, toast, failed],
  );

  const togglePromotion = useCallback(
    (promotionId: number) => {
      const promo = promotions.find((p) => p.id === promotionId);
      if (!promo) return;
      const saved = { ...promo, active: !promo.active };
      setPromotions((prev) => prev.map((p) => (p.id === promotionId ? saved : p)));
      api.savePromotion(saved).catch(() => failed(promo.name));
    },
    [promotions, failed],
  );

  const deletePromotion = useCallback(
    (promotionId: number) => {
      const promo = promotions.find((p) => p.id === promotionId);
      if (!promo) return;
      setPromotions((prev) => prev.filter((p) => p.id !== promotionId));
      toast({
        message: "Promoción eliminada",
        action: { label: "Deshacer", onClick: () => setPromotions((prev) => [promo, ...prev]) },
      });
      api.deletePromotion(promotionId).catch(() => failed(promo.name));
    },
    [promotions, toast, failed],
  );

  const value = useMemo(
    () => ({
      categories,
      products,
      promotions,
      toggleAvailable,
      saveProduct,
      deleteProduct,
      moveProduct,
      moveCategory,
      saveCategory,
      savePromotion,
      togglePromotion,
      deletePromotion,
    }),
    [
      categories,
      products,
      promotions,
      toggleAvailable,
      saveProduct,
      deleteProduct,
      moveProduct,
      moveCategory,
      saveCategory,
      savePromotion,
      togglePromotion,
      deletePromotion,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
