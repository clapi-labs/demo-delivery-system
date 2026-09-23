import { createMenuToken } from "@sistema/shared";

import { env } from "@/env";

/**
 * Construye el link al menú (ADR-05).
 *
 * El criterio es *"el punto donde el cliente iba a llegar de todos modos"*,
 * no *"el más vistoso"*. Tres formas:
 *
 * | Situación | Link |
 * |---|---|
 * | Consultó algo y hay palabras útiles | `?q=…` — buscador lleno |
 * | Quiere comprar algo identificado | `?add=SKU:cant` — carrito armado |
 * | Nada identificado | el menú pelado |
 *
 * El token firmado (`?t=…`) viaja siempre: es lo que permite que el pedido
 * vuelva solo a WhatsApp sin que el cliente escriba el código (RF-26). Es una
 * URL absoluta hacia `apps/menu` porque el bot y el menú son despliegues
 * distintos — no hay una ruta relativa que sirva entre los dos.
 */

export type MenuTarget =
  | { kind: "catalog" }
  | { kind: "search"; query: string }
  | { kind: "cart"; items: { sku: string; quantity: number }[] };

export function buildMenuUrl(phone: string, target: MenuTarget = { kind: "catalog" }) {
  const token = createMenuToken(phone, env.menuTokenSecret);

  const params = new URLSearchParams({ t: token });

  if (target.kind === "search") {
    params.set("q", target.query);
  } else if (target.kind === "cart" && target.items.length > 0) {
    params.set(
      "add",
      target.items.map((i) => `${i.sku}:${i.quantity}`).join(","),
    );
  }

  return `${env.urls.menu}/?${params.toString()}`;
}

/** El botón cambia según a dónde apunta el link. Que siempre diga lo mismo
 *  aunque el destino sea otro es lo que confunde. */
export function menuButtonLabel(target: MenuTarget) {
  switch (target.kind) {
    case "cart":
      return "Ir al carrito";
    case "search":
      return "Ver opciones";
    default:
      return "Ver el menú";
  }
}
