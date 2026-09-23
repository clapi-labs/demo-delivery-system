"use client";

import { useEffect } from "react";

/**
 * Temperatura de la página: escribe `--heat` en `<html>`, de 1 arriba (llama
 * viva bajo el héroe) a 0 abajo (carbón frío al final de la carta).
 *
 * Se escribe una sola propiedad y como mucho una vez por frame. Las capas
 * que dependen de ella sólo cambian de opacidad —el color y la posición del
 * degradado son fijos—, así que el compositor las resuelve sin repintar y
 * el scroll no se resiente.
 */
export function useScrollHeat() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Con movimiento reducido el fuego se queda quieto a media brasa: el
    // material sigue ahí, pero deja de responder al scroll.
    if (reduced.matches) {
      root.style.setProperty("--heat", "0.5");
      return;
    }

    let frame = 0;

    const update = () => {
      frame = 0;
      const scrollable = document.body.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      root.style.setProperty("--heat", String(1 - progress));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      root.style.removeProperty("--heat");
    };
  }, []);
}
