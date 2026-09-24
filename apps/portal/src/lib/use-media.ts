"use client";

import { useSyncExternalStore } from "react";

/**
 * ¿Coincide esta media query? `false` en el servidor.
 *
 * Se usa para decidir entre arrastrar con mouse (escritorio) y deslizar con
 * el dedo (celular): son gestos distintos para la misma acción.
 */
export function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
