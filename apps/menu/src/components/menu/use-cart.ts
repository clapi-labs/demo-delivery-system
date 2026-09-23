"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { resolveOptions, unitPriceWithOptions, type CatalogProduct } from "@sistema/shared";

import { cartLineKey, readCart, writeCart, type CartItem } from "@/lib/cart";

export type CartLine = {
  key: string;
  product: CatalogProduct;
  optionIds: number[];
  optionNames: string[];
  unitPrice: number;
  quantity: number;
};

/**
 * El estado del carrito en el navegador (RF-21).
 *
 * `initialAdd` es lo que trajo `?add=` (RF-23): se fusiona con lo que ya
 * hubiera en `localStorage` tomando el MÁXIMO por línea, no la suma — así
 * recargar el mismo link no duplica lo que el cliente ya tenía.
 */
export function useCart(catalog: CatalogProduct[], initialAdd: CartItem[]) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readCart();
    if (initialAdd.length === 0) {
      // No se puede leer `localStorage` durante el render del servidor — que
      // el valor real solo llegue tras montar es intencional, no un efecto
      // que se debería evitar: es la única forma de no desincronizar el HTML
      // del servidor con lo que había en el navegador.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(stored);
      setHydrated(true);
      return;
    }

    const merged = [...stored];
    for (const incoming of initialAdd) {
      const key = cartLineKey(incoming.sku, incoming.optionIds);
      const existing = merged.find((i) => cartLineKey(i.sku, i.optionIds) === key);
      if (existing) {
        existing.quantity = Math.max(existing.quantity, incoming.quantity);
      } else {
        merged.push(incoming);
      }
    }
    setItems(merged);
    setHydrated(true);
    // Solo al montar: `initialAdd` viene de la URL con la que se abrió la
    // página, no debe volver a fusionarse en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated) writeCart(items);
  }, [items, hydrated]);

  const add = useCallback((sku: string, optionIds: number[], quantity = 1) => {
    setItems((prev) => {
      const key = cartLineKey(sku, optionIds);
      const existing = prev.find((i) => cartLineKey(i.sku, i.optionIds) === key);
      if (existing) {
        return prev.map((i) =>
          cartLineKey(i.sku, i.optionIds) === key
            ? { ...i, quantity: i.quantity + quantity }
            : i,
        );
      }
      return [...prev, { sku, optionIds, quantity }];
    });
  }, []);

  const removeOne = useCallback((key: string) => {
    setItems((prev) =>
      prev
        .map((i) =>
          cartLineKey(i.sku, i.optionIds) === key
            ? { ...i, quantity: i.quantity - 1 }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const removeAll = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => cartLineKey(i.sku, i.optionIds) !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const lines: CartLine[] = useMemo(
    () =>
      items
        .map((item) => {
          const product = catalog.find((p) => p.sku === item.sku);
          if (!product) return null;
          const options = resolveOptions(product, item.optionIds);
          return {
            key: cartLineKey(item.sku, item.optionIds),
            product,
            optionIds: item.optionIds,
            optionNames: options.map((o) => o.name),
            unitPrice: unitPriceWithOptions(product, item.optionIds),
            quantity: item.quantity,
          };
        })
        .filter((l): l is CartLine => l !== null),
    [items, catalog],
  );

  const count = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);
  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [lines],
  );

  return { items, lines, count, subtotal, add, removeOne, removeAll, clear };
}
