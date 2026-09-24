"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { MenuCategory, MenuProduct, Promotion } from "@/lib/menu";
import * as api from "@/lib/portal-api";

import { useToast } from "./ToastProvider";

/**
 * El menú que administra el restaurante, en el layout para que los cambios
 * sobrevivan a navegar entre pantallas (y el Inicio sepa cuántos agotados hay).
 *
 * El catálogo y las promociones salen de Neon (`GET /api/menu`) — es el mismo
 * catálogo que ve el cliente en el menú público y que consulta el bot, no una
 * copia. Marcar agotado y administrar promociones se guardan de verdad.
 *
 * **Crear y editar productos y categorías todavía NO se guardan**: la foto de
 * un producto necesita almacenamiento externo (en Vercel el disco se borra) y
 * esa decisión sigue abierta. `editingSaves` existe para que la interfaz lo
 * diga en pantalla en vez de fingir que guardó.
 */

type MenuContext = {
  categories: MenuCategory[];
  products: MenuProduct[];
  promotions: Promotion[];
  /** Falso mientras crear/editar productos no se guarde en la base. */
  editingSaves: boolean;
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
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const load = useCallback(async () => {
    try {
      const menu = await api.fetchMenu();
      setCategories(menu.categories);
      setProducts(menu.products);
      setPromotions(menu.promotions);
    } catch {
      // Un fallo puntual no borra lo que ya está en pantalla.
    }
  }, []);

  useEffect(() => {
    // El menú cambia poco: basta cargarlo al entrar y al volver a la pestaña.
    // No hace falta el sondeo de Pedidos, que sí cambia solo.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `load` es async; el setState real ocurre después del `await`, no de forma síncrona.
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

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
      // El id provisional solo sirve para que React tenga una `key` mientras
      // viaja la petición; el de verdad lo asigna Postgres y llega de vuelta.
      const optimistic = isNew ? { ...promotion, id: nextId(promotions) } : promotion;
      setPromotions((prev) =>
        isNew ? [optimistic, ...prev] : prev.map((p) => (p.id === optimistic.id ? optimistic : p)),
      );
      toast({ message: isNew ? "Promoción creada" : "Promoción guardada" });
      api
        .savePromotion(promotion)
        .then((saved) =>
          setPromotions((prev) => prev.map((p) => (p.id === optimistic.id ? saved : p))),
        )
        .catch(() => {
          setPromotions((prev) =>
            isNew ? prev.filter((p) => p.id !== optimistic.id) : prev.map((p) => (p.id === promotion.id ? promotion : p)),
          );
          failed(promotion.name);
        });
    },
    [promotions, toast, failed],
  );

  const togglePromotion = useCallback(
    (promotionId: number) => {
      const promo = promotions.find((p) => p.id === promotionId);
      if (!promo) return;
      const active = !promo.active;
      setPromotions((prev) => prev.map((p) => (p.id === promotionId ? { ...p, active } : p)));
      api.setPromotionActive(promotionId, active).catch(() => {
        setPromotions((prev) => prev.map((p) => (p.id === promotionId ? promo : p)));
        failed(promo.name);
      });
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
        // "Deshacer" la vuelve a crear en la base: ya se borró de verdad, así
        // que restaurarla solo en pantalla dejaría una promo fantasma que
        // desaparece al recargar.
        action: {
          label: "Deshacer",
          onClick: () => {
            setPromotions((prev) => [promo, ...prev]);
            api
              .savePromotion({ ...promo, id: 0 })
              .then((saved) => setPromotions((prev) => prev.map((p) => (p.id === promo.id ? saved : p))))
              .catch(() => failed(promo.name));
          },
        },
      });
      api.deletePromotion(promotionId).catch(() => {
        setPromotions((prev) => [promo, ...prev]);
        failed(promo.name);
      });
    },
    [promotions, toast, failed],
  );

  const value = useMemo(
    () => ({
      categories,
      products,
      promotions,
      editingSaves: false,
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
