import {
  BUSINESS,
  DAY_NAMES,
  appliesTo,
  businessDay,
  formatCOP,
  hoursPhrase,
  normalize,
  promoPrice,
  promoValueLabel,
  promotionsOnDay,
  searchProducts,
  type CatalogCategory,
  type CatalogProduct,
  type Promotion,
} from "@sistema/shared";

import { askLlm, type LlmTool } from "@/services/openai/chat";

import { buildMenuUrl, menuButtonLabel, type MenuTarget } from "./menu-link";
import { MESSAGES } from "./messages";
import type { BotReply } from "./types";

/**
 * El turno de conversación libre (RF-13, ADR-08).
 *
 * **El reparto de trabajo es la parte importante.** El modelo solo extrae
 * *qué nombró el cliente*; si existe, cuánto vale y si hay stock lo decide el
 * código contra el catálogo (`searchProducts`). Es la lección más cara del
 * sistema real: un modelo que afirma precios por su cuenta termina inventando
 * alguno, y frente a un cliente real eso se ve pésimo.
 *
 * La misma regla vale para lo que se agregó después:
 *
 * - **Promociones.** El modelo solo dice *de qué día* preguntan. Qué promoción
 *   corre ese día, a qué productos aplica y en cuánto los deja lo resuelve el
 *   código contra la tabla `promotions`. Inventarse un descuento es la clase
 *   de error que el restaurante termina teniendo que honrar.
 * - **Recomendaciones por ingredientes.** El modelo traduce "que no tenga
 *   queso" a `exclude: ["queso"]`; **cuáles** productos cumplen lo filtra el
 *   código contra las descripciones reales del catálogo.
 *
 * Cinco herramientas, y ninguna toca un pedido (ADR-02) — el candado sigue
 * siendo estructural, no depende de que el modelo se comporte.
 */

const TOOLS: LlmTool[] = [
  {
    name: "reply",
    description:
      "Responder al cliente con un mensaje de conversación: saludos, datos " +
      "del negocio, horarios, agradecimientos.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "El mensaje para el cliente." },
      },
      required: ["message"],
    },
  },
  {
    name: "lookup_products",
    description:
      "Usar SIEMPRE que el cliente mencione uno o más productos POR SU " +
      "NOMBRE, pregunte si hay algo, cuánto vale, o quiera pedirlo. No " +
      "afirmes precios ni disponibilidad por tu cuenta: esta herramienta los " +
      "resuelve.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description:
            "TODOS los productos que nombró, uno por elemento. Si dijo tres " +
            "cosas, manda tres elementos — no resumas ni te quedes con el " +
            "primero.",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description:
                  "El producto con LAS PALABRAS del cliente. Ej: 'hamburguesa doble'.",
              },
              quantity: {
                type: "integer",
                description: "Cuántos pidió. 1 si no dijo cantidad.",
              },
            },
            required: ["name"],
          },
        },
        wants_to_buy: {
          type: "boolean",
          description:
            "true si lo quiere pedir o llevar — 'quiero', 'dame', 'me " +
            "regala', 'agrégame', o cualquier cantidad ('dos hamburguesas'). " +
            "false SOLO si está preguntando precio o si hay.",
        },
      },
      required: ["items", "wants_to_buy"],
    },
  },
  {
    name: "recommend_products",
    description:
      "Usar cuando el cliente NO nombra un producto concreto sino que " +
      "describe lo que busca por sus ingredientes o características: 'una " +
      "hamburguesa que no tenga queso', 'algo sin carne', 'lo más barato con " +
      "pollo', 'algo picante'. No elijas tú el producto: esta herramienta " +
      "filtra el catálogo real por su descripción. Si el cliente NOMBRA un " +
      "plato concreto —aunque creas que no lo tenemos, como 'sushi'— usa " +
      "`lookup_products`, no esta. Y no la llames sin ningún filtro.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "La categoría, si la dijo: 'hamburguesas', 'pollo', " +
            "'acompañamientos', 'bebidas', 'postres'. Omitir si no la dijo.",
        },
        include: {
          type: "array",
          items: { type: "string" },
          description:
            "Ingredientes o rasgos que el cliente pidió EXPLÍCITAMENTE, en " +
            "singular y sin artículos. Ej: ['pollo'], ['picante']. No " +
            "inventes sinónimos ni deduzcas: para 'algo sin carne' esto va " +
            "VACÍO y el ingrediente va en `exclude`.",
        },
        exclude: {
          type: "array",
          items: { type: "string" },
          description:
            "Ingredientes que NO quiere. Ej: para 'sin queso' -> ['queso']; " +
            "para 'sin carne' -> ['carne'].",
        },
        cheapest: {
          type: "boolean",
          description: "true si pidió lo más barato o lo más económico.",
        },
      },
      required: [],
    },
  },
  {
    name: "lookup_promotions",
    description:
      "Usar SIEMPRE que el cliente pregunte por promociones, descuentos, " +
      "ofertas, combos o 'qué hay hoy'. NUNCA afirmes tú que hay o no hay " +
      "una promoción, ni cuál es: esta herramienta lo resuelve contra lo que " +
      "el restaurante tiene publicado.",
    input_schema: {
      type: "object",
      properties: {
        day: {
          type: "string",
          description:
            "El día por el que pregunta: 'hoy', 'mañana', o el nombre del " +
            "día ('viernes'). Usar 'todas' si pregunta en general, sin día.",
        },
      },
      required: [],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Pasar la conversación a una persona del equipo. Usar cuando el cliente " +
      "lo pida, se queje de un pedido ya hecho, o cuando no puedas resolver " +
      "algo con seguridad. Es mejor escalar que inventar.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Por qué se escala, en una frase. Lo lee el supervisor.",
        },
      },
      required: ["reason"],
    },
  },
];

function buildSystemPrompt(catalog: CatalogCategory[], hasPromotions: boolean) {
  // Con descripción, no solo nombre y precio: sin los ingredientes a la vista
  // el modelo no puede traducir "que no tenga queso" a un `exclude` útil.
  const menu = catalog
    .map((cat) => {
      const items = cat.products
        .map(
          (p) =>
            `  - ${p.name} (${formatCOP(p.price)})${p.available ? "" : " [AGOTADO]"}: ${p.description}`,
        )
        .join("\n");
      return `${cat.name}:\n${items}`;
    })
    .join("\n\n");

  const promoNote = hasPromotions
    ? "Hoy el restaurante TIENE promociones publicadas. Nunca digas cuáles ni des por hecho que no hay: llama a `lookup_promotions`."
    : "Si preguntan por promociones, llama igual a `lookup_promotions` — puede haber una para otro día.";

  return `Eres el asistente de *${BUSINESS.name}*, un restaurante de comida rápida en Colombia que atiende domicilios por WhatsApp.

TU TRABAJO
Informas, resuelves dudas y llevas al cliente al menú. **No armas pedidos por chat**: el carrito vive en el menú web. Si el cliente quiere pedir algo, se lo dejas listo en el menú y él lo envía desde ahí.

CÓMO HABLAS
- Colombiano, cercano y breve. Tuteas. Puedes usar "veci" de vez en cuando.
- Mensajes cortos: dos o tres frases. Esto es WhatsApp, no un correo.
- Un emoji ocasional, no en cada frase.
- Nunca inventes productos, precios ni promociones.

REGLA QUE NO SE ROMPE
Si el cliente nombra CUALQUIER producto o tipo de comida —para preguntar si hay, cuánto vale, o para pedirlo— usa \`lookup_products\`, y mándale **todos** los productos que nombró con su cantidad: si pidió tres cosas, van tres. Si en vez de nombrarlo lo describe por ingredientes ("algo sin queso", "que tenga pollo"), usa \`recommend_products\`. Esto aplica IGUAL si crees que no lo tenemos: no digas tú mismo "no manejamos X" ni "no tenemos eso" por tu cuenta, ni siquiera basándote en la lista del menú de arriba. Esa lista es solo para que entiendas el negocio — el veredicto de qué existe, cuánto vale y si hay stock SIEMPRE lo da la herramienta contra la base real, nunca tu lectura del prompt.

PROMOCIONES
${promoNote}

DATOS DEL NEGOCIO
Horario: ${BUSINESS.hours}
Domicilio: ${formatCOP(BUSINESS.deliveryFee)}, llega en ${BUSINESS.deliveryTime}
Pedido mínimo: ${formatCOP(BUSINESS.minOrder)}
${BUSINESS.zone}
Pagos: transferencia (Nequi ${BUSINESS.payments.nequi}) o efectivo.

MENÚ (referencia; los precios exactos los dan las herramientas)
${menu}`;
}

export async function runAdvisor(
  phone: string,
  catalog: CatalogCategory[],
  promotions: Promotion[],
  history: { role: "user" | "assistant"; content: string }[],
): Promise<BotReply> {
  const today = promotionsOnDay(promotions, businessDay());
  const result = await askLlm(
    buildSystemPrompt(catalog, today.length > 0),
    history,
    TOOLS,
  );

  // RF-17: sin modelo (o con el modelo caído) el bot responde igual.
  if (!result) {
    return {
      text: MESSAGES.llmUnavailable(),
      menu: {
        url: buildMenuUrl(phone),
        label: menuButtonLabel({ kind: "catalog" }),
      },
    };
  }

  if (result.kind === "text") {
    return { text: result.text };
  }

  switch (result.name) {
    case "escalate_to_human": {
      const reason =
        typeof result.input.reason === "string"
          ? result.input.reason
          : "El asistente no pudo resolver la solicitud.";
      return { text: MESSAGES.escalatedByBot(), escalated: { reason } };
    }

    case "lookup_products":
      return answerProducts(phone, catalog, result.input);

    case "recommend_products":
      return answerRecommendation(phone, catalog, result.input);

    case "lookup_promotions":
      return answerPromotions(phone, catalog, promotions, result.input);

    case "reply":
    default: {
      const message =
        typeof result.input.message === "string"
          ? result.input.message
          : MESSAGES.llmUnavailable();
      return { text: message };
    }
  }
}

// --- Productos por nombre ----------------------------------------------------

/**
 * Compone la respuesta de productos **desde el catálogo**, no desde el
 * modelo.
 *
 * Tres desenlaces por producto nombrado, y cada uno lleva a un sitio distinto
 * del menú:
 *
 * - Uno solo y disponible → se dice el precio y el link va a su búsqueda.
 * - Agotado → se dice a secas, sin ofrecer sustitutos. A quien pidió cerveza
 *   se le contesta por la cerveza.
 * - Varias opciones → no se elige por el cliente; el link abre el buscador.
 * - Nada → "no manejamos eso", que lo decide el catálogo y no el modelo.
 */
/**
 * Lo que el modelo dice que pidió el cliente, saneado.
 *
 * Acepta también la forma vieja (`names: string[]`) porque el modelo a veces
 * la devuelve igual: entre que un cliente pida tres cosas y reciba una sola
 * porque el JSON no vino como esperábamos, prefiero el reintento barato.
 */
function parseRequestedItems(input: Record<string, unknown>) {
  const raw = Array.isArray(input.items)
    ? input.items
    : Array.isArray(input.names)
      ? input.names
      : [];

  // Se agrupan por nombre normalizado: el modelo a veces manda el mismo
  // producto repetido en vez de mandar `quantity`, y sin esto el cliente
  // recibe "No manejamos *sushi*." tres veces seguidas.
  const merged = new Map<string, { name: string; quantity: number }>();

  for (const entry of raw.slice(0, 10)) {
    const name = typeof entry === "string" ? entry : (entry as { name?: unknown })?.name;
    if (typeof name !== "string" || !name.trim()) continue;

    const rawQuantity = typeof entry === "object" && entry !== null ? (entry as { quantity?: unknown }).quantity : 1;
    // Un tope de 20: una cantidad disparatada casi siempre es el modelo
    // leyendo mal un precio, no alguien pidiendo cincuenta hamburguesas.
    const quantity = Number.isInteger(rawQuantity)
      ? Math.min(20, Math.max(1, rawQuantity as number))
      : 1;

    const key = normalize(name);
    const existing = merged.get(key);
    if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
    else merged.set(key, { name: name.trim(), quantity });
  }

  return [...merged.values()].slice(0, 6);
}

function answerProducts(
  phone: string,
  catalog: CatalogCategory[],
  input: Record<string, unknown>,
): BotReply {
  const items = parseRequestedItems(input);

  if (items.length === 0) {
    return {
      text: MESSAGES.menuLink(),
      menu: { url: buildMenuUrl(phone), label: menuButtonLabel({ kind: "catalog" }) },
    };
  }

  // Una cantidad explícita ("dos hamburguesas") es una compra, diga lo que
  // diga el modelo: nadie pregunta el precio de dos.
  const wantsToBuy = input.wants_to_buy === true || items.some((i) => i.quantity > 1);
  const parts: string[] = [];
  const toCart: { sku: string; quantity: number }[] = [];
  const searchTerms: string[] = [];

  for (const { name, quantity } of items) {
    const matches = searchProducts(catalog, name);
    const available = matches.filter((p) => p.available);

    if (matches.length === 0) {
      parts.push(`No manejamos *${name}*.`);
      continue;
    }

    if (available.length === 0) {
      parts.push(`*${matches[0].name}* está agotado por ahora.`);
      continue;
    }

    if (available.length === 1) {
      const product = available[0];
      const count = quantity > 1 ? `${quantity}× ` : "";
      const total = quantity > 1 ? ` (${formatCOP(product.price * quantity)})` : "";
      parts.push(`${count}*${product.name}* — ${formatCOP(product.price)}${total}.`);
      if (wantsToBuy) toCart.push({ sku: product.sku, quantity });
      else searchTerms.push(name);
      continue;
    }

    // Varias opciones: no se elige por el cliente.
    const preview = available
      .slice(0, 3)
      .map((p) => `${p.name} (${formatCOP(p.price)})`)
      .join(", ");
    parts.push(`De *${name}* tenemos varias: ${preview}.`);
    searchTerms.push(name);
  }

  const target: MenuTarget =
    toCart.length > 0
      ? { kind: "cart", items: toCart }
      : searchTerms.length === 1
        ? { kind: "search", query: searchTerms[0] }
        : { kind: "catalog" };

  const closing =
    target.kind === "cart"
      ? // Si algo quedó sin resolver (varias opciones, agotado), decirlo: un
        // "te lo dejé todo en el carrito" que no es cierto se descubre al
        // abrirlo, y ahí ya se perdió la confianza.
        searchTerms.length > 0 || parts.length > toCart.length
        ? "Lo que pude te lo dejé en el carrito; lo demás lo eliges ahí mismo 👇"
        : "Te lo dejé en el carrito. Revisa que esté todo y me lo envías desde ahí 👇"
      : target.kind === "search"
        ? "Ábrelo para verlo y agregarlo 👇"
        : "Agrégalo desde el menú y me lo envías desde ahí 👇";

  return {
    text: `${parts.join("\n")}\n\n${closing}`,
    menu: { url: buildMenuUrl(phone, target), label: menuButtonLabel(target) },
  };
}

// --- Recomendación por ingredientes ------------------------------------------

/**
 * Ingredientes que en una carta se nombran por su corte, no por su categoría.
 *
 * El filtro busca la palabra en la descripción, y ahí dice "costilla
 * desmechada" o "tocineta crocante", nunca "carne". Sin esta tabla, a quien
 * pide algo sin carne se le ofrece costilla — pasó, y en una demo eso se ve
 * peor que no contestar.
 *
 * Se queda corto a propósito: solo cubre las exclusiones que un cliente pide
 * de verdad. La solución de fondo es etiquetar los productos por ingrediente
 * en el catálogo, que es trabajo de otra fase.
 */
const EXCLUDE_ALSO: Record<string, string[]> = {
  carne: ["res", "costilla", "tocineta", "cerdo", "chorizo"],
  res: ["carne"],
  pollo: ["pechuga", "alitas", "alita"],
  queso: ["cheddar", "feta", "parmesano", "mozzarella"],
  cerdo: ["tocineta", "costilla", "chorizo"],
  picante: ["jalapeño", "jalapeno"],
};

function expandExclude(terms: string[]) {
  return [...new Set(terms.flatMap((t) => [t, ...(EXCLUDE_ALSO[t] ?? [])]))];
}

/** Todo el texto por el que se puede buscar un ingrediente en un producto. */
function searchableText(product: CatalogProduct, withOptions: boolean) {
  const options = withOptions
    ? product.optionGroups.flatMap((g) => [g.name, ...g.options.map((o) => o.name)]).join(" ")
    : "";
  return normalize(`${product.name} ${product.description} ${options}`);
}

/**
 * "¿Tienes una hamburguesa que no tenga queso?"
 *
 * El filtro corre contra la **descripción real** del producto, que es donde
 * están los ingredientes. Dos asimetrías, y las dos importan:
 *
 * - Lo que se EXCLUYE se busca solo en nombre y descripción, nunca en las
 *   opciones. "Queso adicional" es un extra que el cliente elige; descartar la
 *   Hamburguesa de Pollo porque se le *puede* agregar queso sería absurdo.
 * - Lo que se INCLUYE sí mira las opciones: quien pide "algo picante" se
 *   conforma con unas alitas que traen salsa picante entre sus opciones.
 */
function answerRecommendation(
  phone: string,
  catalog: CatalogCategory[],
  input: Record<string, unknown>,
): BotReply {
  const terms = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((t): t is string => typeof t === "string").map(normalize).filter(Boolean)
      : [];

  const include = terms(input.include);
  const asked = terms(input.exclude);
  const exclude = expandExclude(asked);
  const categoryQuery = typeof input.category === "string" ? normalize(input.category) : "";

  const category = categoryQuery
    ? catalog.find(
        (c) => normalize(c.name).includes(categoryQuery) || categoryQuery.includes(normalize(c.name)),
      )
    : undefined;

  // Sin un solo filtro no hay nada que recomendar. Pasa cuando el modelo
  // alcanza esta herramienta para algo que no le corresponde (le preguntaron
  // por sushi y la llamó sin argumentos): devolver tres productos al azar
  // sería el bot eligiendo por el cliente, justo lo que ADR-02 evita.
  if (!category && include.length === 0 && asked.length === 0) {
    return {
      text: MESSAGES.menuLink(),
      menu: { url: buildMenuUrl(phone), label: menuButtonLabel({ kind: "catalog" }) },
    };
  }

  const pool = (category ? [category] : catalog).flatMap((c) => c.products).filter((p) => p.available);

  const filter = (wanted: string[]) =>
    pool.filter((product) => {
      const withOptions = searchableText(product, true);
      const withoutOptions = searchableText(product, false);
      return (
        wanted.every((t) => withOptions.includes(t)) &&
        !exclude.some((t) => withoutOptions.includes(t))
      );
    });

  let matches = filter(include);

  // El modelo a veces traduce "algo sin carne" a `include: ["verduras"]`, una
  // palabra que no aparece en ninguna descripción — y el filtro devuelve cero
  // aunque sí haya qué ofrecer. Lo que el cliente dijo de verdad es lo que NO
  // quiere, así que si sus "sí quiero" dejan la lista vacía, se sueltan y se
  // responde con lo que cumple la exclusión.
  let usedInclude = include;
  if (matches.length === 0 && include.length > 0 && asked.length > 0) {
    matches = filter([]);
    usedInclude = [];
  }

  if (input.cheapest === true) {
    matches = [...matches].sort((a, b) => a.price - b.price);
  }

  // La frase usa lo que PIDIÓ el cliente, no la lista expandida: "sin carne"
  // se lee mejor que "sin carne ni res ni costilla ni tocineta".
  const what = describeRequest(category?.name, usedInclude, asked);

  if (matches.length === 0) {
    return {
      text: nothingMatches(what),
      menu: { url: buildMenuUrl(phone), label: menuButtonLabel({ kind: "catalog" }) },
    };
  }

  const picks = matches.slice(0, 3);
  const lines = picks.map((p) => `• *${p.name}* — ${formatCOP(p.price)}. ${p.description}`);

  const target: MenuTarget =
    picks.length === 1
      ? { kind: "search", query: picks[0].name }
      : category
        ? { kind: "search", query: category.name }
        : { kind: "catalog" };

  const intro =
    picks.length === 1 ? `Sí, tengo ${what}:` : `Para ${what} te sirven estas:`;

  return {
    text: `${intro}\n${lines.join("\n")}\n\nÁbrelo para verlo y agregarlo 👇`,
    menu: { url: buildMenuUrl(phone, target), label: menuButtonLabel(target) },
  };
}

/** "hamburguesas sin queso", para que la frase no quede genérica. */
function describeRequest(categoryName: string | undefined, include: string[], exclude: string[]) {
  const base = categoryName ? categoryName.toLowerCase() : "algo";
  const con = include.length ? ` con ${include.join(" y ")}` : "";
  const sin = exclude.length ? ` sin ${exclude.join(" ni ")}` : "";
  return `${base}${con}${sin}`.trim();
}

/** Lo que se le dice al cliente cuando el filtro no encontró nada. */
function nothingMatches(what: string) {
  return `No tengo ${what} por ahora 😕 Mira el menú completo, de pronto hay algo que te sirva 👇`;
}

// --- Promociones --------------------------------------------------------------

const DAY_BY_NAME = new Map(DAY_NAMES.map((name, index) => [normalize(name), index]));

/**
 * De lo que dijo el modelo al día de la semana.
 *
 * "hoy" y "mañana" se resuelven con el reloj **del negocio**, no con el del
 * servidor: en Vercel las funciones corren en UTC, así que un viernes a las
 * 7 p.m. en Colombia el servidor ya cree que es sábado.
 */
function resolveDay(raw: unknown): { day: number; label: string } | null {
  const value = normalize(typeof raw === "string" ? raw : "");
  if (!value || value === "todas" || value === "todos" || value === "cualquiera") return null;

  if (value.includes("hoy")) return { day: businessDay(), label: "hoy" };
  if (value.includes("manana")) return { day: (businessDay() + 1) % 7, label: "mañana" };

  for (const [name, index] of DAY_BY_NAME) {
    if (value.includes(name)) return { day: index, label: `el ${DAY_NAMES[index]}` };
  }

  return null;
}

/**
 * Responde por las promociones **desde la tabla**, nunca desde el modelo.
 *
 * Cada promoción se cuenta con los nombres y los precios reales de los
 * productos a los que aplica: un "20% en hamburguesas" a secas no le dice
 * nada al cliente, y "la Clásica te queda en $14.400" sí.
 */
function answerPromotions(
  phone: string,
  catalog: CatalogCategory[],
  promotions: Promotion[],
  input: Record<string, unknown>,
): BotReply {
  const asked = resolveDay(input.day);
  const list = asked
    ? promotionsOnDay(promotions, asked.day)
    : promotions.filter((p) => p.active);

  const when = asked?.label ?? "por ahora";

  if (list.length === 0) {
    const otherDays = promotions.filter((p) => p.active);
    const hint =
      asked && otherDays.length > 0
        ? ` Eso sí, ${otherDays.length === 1 ? "tenemos una promo otros días" : "tenemos promos otros días"} — pregúntame por otro día 😉`
        : "";
    return {
      text: `${asked ? `No tenemos promoción para ${when}` : "Ahora mismo no tenemos promociones activas"}.${hint}\n\nIgual te dejo el menú 👇`,
      menu: { url: buildMenuUrl(phone), label: menuButtonLabel({ kind: "catalog" }) },
    };
  }

  const lines = list.slice(0, 4).map((promo) => describePromotion(promo, catalog));
  const intro =
    asked?.label === "hoy"
      ? "Hoy tenemos:"
      : asked
        ? `Para ${when} tenemos:`
        : "Estas son las promos que tenemos:";

  // Si toda la lista apunta a la misma categoría, el link abre justo esa.
  const target = promotionTarget(list, catalog);

  return {
    text: `${intro}\n${lines.join("\n")}\n\n${
      target.kind === "search" ? "Ábrelo para verlo 👇" : "Míralo en el menú 👇"
    }`,
    menu: { url: buildMenuUrl(phone, target), label: menuButtonLabel(target) },
  };
}

function productsUnder(promo: Promotion, catalog: CatalogCategory[]) {
  return catalog.flatMap((c) => c.products).filter((p) => p.available && appliesTo(promo, p));
}

function describePromotion(promo: Promotion, catalog: CatalogCategory[]) {
  const affected = productsUnder(promo, catalog);
  const hours = promo.from && promo.to ? ` (${hoursPhrase(promo)})` : "";

  // Un solo producto: se puede ser concreto con el precio, que es lo que de
  // verdad mueve a alguien a pedir.
  if (affected.length === 1) {
    const product = affected[0];
    const price = promoPrice(promo, product.price);
    const deal =
      promo.kind === "2x1"
        ? `2x1 en *${product.name}* — llevas dos por ${formatCOP(product.price)}`
        : `*${product.name}* a ${formatCOP(price ?? product.price)} (antes ${formatCOP(product.price)})`;
    return `• ${deal}${hours}.`;
  }

  const scope =
    promo.scope.type === "all"
      ? "todo el menú"
      : promo.scope.type === "category"
        ? catalog
            .filter((c) => promo.scope.type === "category" && promo.scope.ids.includes(c.id))
            .map((c) => c.name.toLowerCase())
            .join(" y ")
        : affected
            .slice(0, 3)
            .map((p) => p.name)
            .join(", ");

  const example = affected[0];
  const examplePrice = example ? promoPrice(promo, example.price) : null;
  const tail =
    example && examplePrice !== null && examplePrice !== example.price
      ? ` — la ${example.name} te queda en ${formatCOP(examplePrice)}`
      : "";

  return `• *${promo.name}*: ${promoValueLabel(promo).toLowerCase()} en ${scope}${tail}${hours}.`;
}

/** Si todas las promos del día apuntan a lo mismo, el link abre esa búsqueda
 *  en vez del catálogo entero. */
function promotionTarget(list: Promotion[], catalog: CatalogCategory[]): MenuTarget {
  const categoryIds = new Set(
    list.flatMap((p) => (p.scope.type === "category" ? p.scope.ids : [])),
  );
  const hasOther = list.some((p) => p.scope.type !== "category");

  if (!hasOther && categoryIds.size === 1) {
    const category = catalog.find((c) => categoryIds.has(c.id));
    if (category) return { kind: "search", query: category.name };
  }

  if (list.length === 1) {
    const affected = productsUnder(list[0], catalog);
    if (affected.length === 1) return { kind: "search", query: affected[0].name };
  }

  return { kind: "catalog" };
}
