import { BUSINESS, formatCOP, searchProducts, type CatalogCategory } from "@sistema/shared";

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
 * Tres herramientas, y ninguna toca un pedido (ADR-02) — el candado sigue
 * siendo estructural, no depende de que el modelo se comporte.
 */

const TOOLS: LlmTool[] = [
  {
    name: "reply",
    description:
      "Responder al cliente con un mensaje de conversación: saludos, datos " +
      "del negocio, recomendaciones generales, agradecimientos.",
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
      "Usar SIEMPRE que el cliente mencione uno o más productos, pregunte si " +
      "hay algo, cuánto vale, o quiera pedir algo. No afirmes precios ni " +
      "disponibilidad por tu cuenta: esta herramienta los resuelve.",
    input_schema: {
      type: "object",
      properties: {
        names: {
          type: "array",
          items: { type: "string" },
          description:
            "Lo que nombró el cliente, con SUS palabras, un elemento por " +
            "producto. Ej: ['hamburguesa doble', 'limonada'].",
        },
        wants_to_buy: {
          type: "boolean",
          description: "true si quiere pedirlo; false si solo está preguntando.",
        },
      },
      required: ["names"],
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

function buildSystemPrompt(catalog: CatalogCategory[]) {
  const menu = catalog
    .map((cat) => {
      const items = cat.products
        .map(
          (p) =>
            `  - ${p.name} (${formatCOP(p.price)})${p.available ? "" : " [AGOTADO]"}`,
        )
        .join("\n");
      return `${cat.name}:\n${items}`;
    })
    .join("\n\n");

  return `Eres el asistente de *${BUSINESS.name}*, un restaurante de comida rápida en Colombia que atiende domicilios por WhatsApp.

TU TRABAJO
Informas, resuelves dudas y llevas al cliente al menú. **No armas pedidos por chat**: el carrito vive en el menú web. Si el cliente quiere pedir algo, se lo dejas listo en el menú y él lo envía desde ahí.

CÓMO HABLAS
- Colombiano, cercano y breve. Tuteas. Puedes usar "veci" de vez en cuando.
- Mensajes cortos: dos o tres frases. Esto es WhatsApp, no un correo.
- Un emoji ocasional, no en cada frase.
- Nunca inventes productos, precios ni promociones.

REGLA QUE NO SE ROMPE
Si el cliente nombra CUALQUIER producto o tipo de comida —para preguntar si hay, cuánto vale, o para pedirlo— usa \`lookup_products\`. Esto aplica IGUAL si crees que no lo tenemos: no digas tú mismo "no manejamos X" ni "no tenemos eso" por tu cuenta, ni siquiera basándote en la lista del menú de arriba. Esa lista es solo para que recomiendes y entiendas el negocio — el veredicto de qué existe, cuánto vale y si hay stock SIEMPRE lo da \`lookup_products\` contra la base real, nunca tu lectura del prompt.

DATOS DEL NEGOCIO
Horario: ${BUSINESS.hours}
Domicilio: ${formatCOP(BUSINESS.deliveryFee)}, llega en ${BUSINESS.deliveryTime}
Pedido mínimo: ${formatCOP(BUSINESS.minOrder)}
${BUSINESS.zone}
Pagos: transferencia (Nequi ${BUSINESS.payments.nequi}) o efectivo.

MENÚ (referencia; los precios exactos los da \`lookup_products\`)
${menu}`;
}

export async function runAdvisor(
  phone: string,
  catalog: CatalogCategory[],
  history: { role: "user" | "assistant"; content: string }[],
): Promise<BotReply> {
  const result = await askLlm(buildSystemPrompt(catalog), history, TOOLS);

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
function answerProducts(
  phone: string,
  catalog: CatalogCategory[],
  input: Record<string, unknown>,
): BotReply {
  const names = Array.isArray(input.names)
    ? input.names.filter((n): n is string => typeof n === "string").slice(0, 6)
    : [];

  if (names.length === 0) {
    return {
      text: MESSAGES.menuLink(),
      menu: { url: buildMenuUrl(phone), label: menuButtonLabel({ kind: "catalog" }) },
    };
  }

  const wantsToBuy = input.wants_to_buy === true;
  const parts: string[] = [];
  const toCart: { sku: string; quantity: number }[] = [];
  const searchTerms: string[] = [];

  for (const name of names) {
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
      parts.push(`*${product.name}* — ${formatCOP(product.price)}.`);
      if (wantsToBuy) toCart.push({ sku: product.sku, quantity: 1 });
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
      ? "Te lo dejé en el carrito. Revisa que esté todo y me lo envías desde ahí 👇"
      : target.kind === "search"
        ? "Ábrelo para verlo y agregarlo 👇"
        : "Agrégalo desde el menú y me lo envías desde ahí 👇";

  return {
    text: `${parts.join("\n")}\n\n${closing}`,
    menu: { url: buildMenuUrl(phone, target), label: menuButtonLabel(target) },
  };
}
