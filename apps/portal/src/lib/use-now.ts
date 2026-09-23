"use client";

import { useSyncExternalStore } from "react";

/**
 * Un reloj compartido para todo el portal.
 *
 * Los tiempos ("hace 4 min", el cronómetro de cada pedido) tienen que avanzar
 * solos: en una cocina nadie recarga la página. Un solo `setInterval` para
 * todos los componentes, no uno por tarjeta.
 *
 * En el servidor devuelve `null`: la hora del servidor no es la del
 * navegador (ni su zona horaria), y pintar tiempos allá solo produce
 * diferencias de hidratación. Los componentes muestran un hueco hasta montar.
 */

const TICK_MS = 15_000;

let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
}
