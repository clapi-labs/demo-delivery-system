import { BUSINESS } from "../config/business-info";
import { formatCOP } from "./format";

/**
 * Promociones: tipos y reglas **puras**.
 *
 * Vive en `domain/` y no toca la base por la misma razón que `catalog.ts`: lo
 * importan el portal (para administrarlas), el menú (para pintar el precio) y
 * el bot (para contestar por ellas). Tres copias de "¿esta promo corre hoy?"
 * se desincronizan sin que nadie lo note, y la que se equivoca le miente a un
 * cliente.
 *
 * El día de la semana es el del **negocio**, no el del servidor: en Vercel las
 * funciones corren en UTC, así que a las 7 p.m. de un viernes en Colombia el
 * servidor ya cree que es sábado. Una promo de viernes se apagaría cinco horas
 * antes de tiempo.
 */

export type PromotionKind = "percent" | "price" | "2x1";

/**
 * A qué le aplica. `ids` son ids reales de `categories` o `products` — por eso
 * el Menú del portal tiene que leer el catálogo de la base y no una copia con
 * ids inventados.
 */
export type PromotionScope =
  | { type: "all" }
  | { type: "category"; ids: number[] }
  | { type: "products"; ids: number[] };

export type Promotion = {
  id: number;
  name: string;
  kind: PromotionKind;
  /** Porcentaje para `percent`, precio final para `price`. No aplica a 2x1. */
  value: number;
  scope: PromotionScope;
  /** 0 = domingo … 6 = sábado, como `Date.getDay()`. */
  days: number[];
  /** "HH:MM" en hora del negocio; `null` en los dos = todo el día. */
  from: string | null;
  to: string | null;
  active: boolean;
};

/** Lo mínimo que hay que saber de un producto para decidir si le aplica. */
export type PromotableProduct = { id: number; categoryId: number };

export const DAY_LETTERS = ["D", "L", "M", "X", "J", "V", "S"];
export const DAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
const DAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// --- El reloj del negocio ----------------------------------------------------

/** Día y minuto del día en la zona horaria del negocio. Ver el comentario de
 *  arriba sobre por qué no se usa `Date.getDay()` a secas. */
export function businessClock(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS.timezone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday").toLowerCase();
  const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(weekday);
  // `hour: numeric` con `hour12: false` devuelve "24" a la medianoche.
  const hour = Number(get("hour")) % 24;

  return { day: day < 0 ? new Date(now).getDay() : day, minutes: hour * 60 + Number(get("minute")) };
}

export function businessDay(now: Date = new Date()) {
  return businessClock(now).day;
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// --- Cuándo corre ------------------------------------------------------------

/** ¿Esta promo corre ese día de la semana? No mira la hora. */
export function runsOnDay(promo: Promotion, day: number) {
  return promo.active && promo.days.includes(day);
}

/** ¿Está corriendo en este preciso momento (día **y** franja horaria)? */
export function isPromotionLive(promo: Promotion, now: Date = new Date()) {
  const { day, minutes } = businessClock(now);
  if (!runsOnDay(promo, day)) return false;
  if (!promo.from || !promo.to) return true;

  const from = toMinutes(promo.from);
  const to = toMinutes(promo.to);
  // Una franja que cruza la medianoche ("22:00 a 01:00") se lee al revés.
  return from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

/** Las que corren ese día, con su franja horaria intacta. */
export function promotionsOnDay(promos: Promotion[], day: number) {
  return promos.filter((p) => runsOnDay(p, day));
}

/** Las que están corriendo ahora mismo. Es lo que el menú usa para el precio. */
export function livePromotions(promos: Promotion[], now: Date = new Date()) {
  return promos.filter((p) => isPromotionLive(p, now));
}

// --- A qué aplica y por cuánto ----------------------------------------------

export function appliesTo(promo: Promotion, product: PromotableProduct) {
  if (promo.scope.type === "all") return true;
  if (promo.scope.type === "category") return promo.scope.ids.includes(product.categoryId);
  return promo.scope.ids.includes(product.id);
}

/**
 * Precio con la promoción aplicada; `null` si la promo no cambia el precio
 * unitario (2x1 — ahí lo que cambia es cuánto te llevas, no cuánto vale uno).
 *
 * El redondeo a los $100 más cercanos no es cosmético: en Colombia no circula
 * moneda por debajo de eso, y un precio de $14.437 en una carta se ve mal.
 */
export function promoPrice(promo: Promotion, price: number) {
  if (promo.kind === "percent") return Math.round((price * (100 - promo.value)) / 100 / 100) * 100;
  if (promo.kind === "price") return Math.min(price, promo.value);
  return null;
}

/**
 * La promo que más le conviene al cliente entre varias que le aplican.
 *
 * Existe porque nada impide que dos promociones se solapen (una de categoría y
 * otra de producto, por ejemplo), y en ese caso la respuesta correcta frente a
 * un cliente es la más barata, no "la primera que encontramos".
 */
export function bestPromotionFor(
  promos: Promotion[],
  product: PromotableProduct & { price: number },
): Promotion | null {
  let best: Promotion | null = null;
  let bestPrice = product.price;

  for (const promo of promos) {
    if (!appliesTo(promo, product)) continue;
    const price = promoPrice(promo, product.price);
    // Un 2x1 no baja el precio unitario, pero sigue siendo una promoción que
    // hay que anunciar si no hay ninguna que sí lo baje.
    if (price === null) {
      best ??= promo;
      continue;
    }
    if (price < bestPrice) {
      best = promo;
      bestPrice = price;
    }
  }

  return best;
}

export function promoValueLabel(promo: Promotion) {
  if (promo.kind === "percent") return `${promo.value}% de descuento`;
  if (promo.kind === "price") return `Precio especial ${formatCOP(promo.value)}`;
  return "2x1";
}

function formatHour(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "p.m." : "a.m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

/** "lun a vie, 3 p.m. a 6 p.m." */
export function scheduleLabel(promo: Promotion) {
  const days = [...promo.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  let dayText: string;
  if (days.length === 7) dayText = "Todos los días";
  else if (days.length === 0) dayText = "Ningún día";
  else {
    // Días seguidos (en orden de lunes a domingo) se leen como un rango.
    const order = days.map((d) => (d + 6) % 7);
    const consecutive = order.every((d, i) => i === 0 || d === order[i - 1] + 1);
    dayText =
      consecutive && days.length > 2
        ? `${DAY_SHORT[days[0]]} a ${DAY_SHORT[days[days.length - 1]]}`
        : days.map((d) => DAY_SHORT[d]).join(", ");
    dayText = dayText[0].toUpperCase() + dayText.slice(1);
  }
  const hours = promo.from && promo.to ? `, ${formatHour(promo.from)} a ${formatHour(promo.to)}` : "";
  return dayText + hours;
}

/** La franja en palabras, para una frase de WhatsApp: "de 3 p.m. a 6 p.m." */
export function hoursPhrase(promo: Promotion) {
  if (!promo.from || !promo.to) return "todo el día";
  return `de ${formatHour(promo.from)} a ${formatHour(promo.to)}`;
}
