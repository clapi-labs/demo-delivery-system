import { NextResponse } from "next/server";

import {
  BUSINESS,
  hoursPhrase,
  isOpenNow,
  livePromotions,
  priceLine,
  promoValueLabel,
  type CatalogCategory,
} from "@sistema/shared";
import { getCatalog, getPromotions } from "@sistema/shared/db";

import { env } from "@/env";

/**
 * El catálogo, para el agente de voz (RF-56, ADR-13).
 *
 * El agente de voz **no tiene base de datos propia**: pide esto una vez al
 * arrancar la llamada y lo inyecta en su prompt. La alternativa era copiar el
 * catálogo a su lado, y se descartó por una razón concreta: marcar un producto
 * como agotado en el portal no llegaría nunca a la llamada, y el bot seguiría
 * vendiendo por teléfono lo que la cocina ya no tiene.
 *
 * Lo que este endpoint hace y que el agente **no puede hacer por su cuenta**:
 *
 * - **Resolver el precio de hoy.** `priceNow` sale de `priceLine()` acá, en el
 *   servidor (RN-02, RN-10). El agente nunca calcula una promoción: lee el
 *   número que se le da. Si un modelo tuviera que aplicar "20% los jueves de
 *   4 a 6", se equivocaría, y se equivocaría diciéndole un precio a un cliente.
 * - **Mandar también lo agotado**, con `available: false`. Es a propósito: si
 *   el cliente lo pide, el agente puede decir "hoy no tenemos" en vez de "no
 *   existe", que suena a que el restaurante no lo vende.
 *
 * Protegido con `INTERNAL_SECRET`. No es un endpoint público: el catálogo
 * público ya existe y es la portada del menú.
 */

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.internalSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [catalog, promotions] = await Promise.all([getCatalog(), getPromotions()]);

  // Un solo instante para todo el catálogo: si no, dos productos de la misma
  // carta podrían quedar uno dentro de la hora feliz y el otro fuera.
  const now = new Date();

  return NextResponse.json({
    business: {
      name: BUSINESS.name,
      hours: BUSINESS.hours,
      open: isOpenNow(now),
      deliveryFee: BUSINESS.deliveryFee,
      deliveryTime: BUSINESS.deliveryTime,
      minOrder: BUSINESS.minOrder,
      zone: BUSINESS.zone,
      whatsappNumber: BUSINESS.whatsappNumber,
    },
    /** Las promociones vivas ahora, para que el agente pueda contestar "¿qué
     *  tienen en promoción?" sin inventarse condiciones. El horario va ya
     *  escrito (`hoursPhrase`) porque un modelo leyendo `from`/`to` en crudo
     *  termina diciendo "de las 16 a las 18". */
    promotions: livePromotions(promotions, now).map((p) => ({
      name: p.name,
      kind: p.kind,
      descuento: promoValueLabel(p),
      horario: hoursPhrase(p),
    })),
    categories: catalog.map((category) => serializeCategory(category, promotions, now)),
  });
}

function serializeCategory(
  category: CatalogCategory,
  promotions: Awaited<ReturnType<typeof getPromotions>>,
  now: Date,
) {
  return {
    slug: category.slug,
    name: category.name,
    products: category.products.map((product) => {
      // Cantidad 1 y sin opciones: lo que se quiere es el precio unitario de
      // hoy, no el total de una línea. El 2x1 no cambia el unitario (cambia
      // cuántas unidades se cobran), así que `kind` viaja aparte, en
      // `promotion`, para que el agente lo pueda explicar.
      const priced = priceLine(product, [], 1, promotions, now);

      return {
        sku: product.sku,
        name: product.name,
        description: product.description,
        price: product.price,
        priceNow: priced.unitPrice,
        promotion: priced.promotion
          ? { name: priced.promotion.name, kind: priced.promotion.kind }
          : null,
        available: product.available,
        optionGroups: product.optionGroups.map((group) => ({
          id: group.id,
          name: group.name,
          type: group.type,
          // El agente pregunta **solo** los obligatorios. Leer en voz alta los
          // extras de 25 productos es insoportable; los opcionales se atienden
          // si el cliente los menciona.
          required: group.required,
          options: group.options.map((option) => ({
            id: option.id,
            name: option.name,
            priceDelta: option.priceDelta,
          })),
        })),
      };
    }),
  };
}
