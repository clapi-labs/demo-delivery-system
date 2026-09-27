import { NextResponse } from "next/server";

import { isOpenNow } from "@sistema/shared";
import { getCatalog } from "@sistema/shared/db";

/**
 * ¿Se pueden tomar pedidos ahora mismo? (RF-59)
 *
 * Lo consulta la página del agente de voz **antes de dejar hablar**: mejor no
 * dejar entrar a una llamada de cuatro minutos que no puede terminar en un
 * pedido, y en su lugar mandar al cliente al WhatsApp donde sí lo atienden.
 *
 * Por eso no responde `200 {ok:true}` a secas: consulta el catálogo de verdad.
 * Un endpoint que solo comprueba que Next arrancó diría "todo bien" con la base
 * caída, que es justo el caso que esto existe para detectar.
 *
 * Es público a propósito (no lleva `INTERNAL_SECRET`): lo llama el navegador
 * del cliente, y lo único que revela es si el restaurante está recibiendo
 * pedidos — lo mismo que ya dice la portada del menú.
 */
export async function GET() {
  try {
    const catalog = await getCatalog();
    const productos = catalog.reduce((n, c) => n + c.products.length, 0);

    // Un catálogo vacío responde 503: la base contestó, pero no hay nada que
    // vender y una llamada no podría cerrar ningún pedido.
    if (productos === 0) {
      return NextResponse.json({ ok: false, reason: "catalogo_vacio" }, { status: 503 });
    }

    return NextResponse.json({ ok: true, open: isOpenNow(), products: productos });
  } catch (error) {
    console.error("[api/health] la base no respondió:", error);
    return NextResponse.json({ ok: false, reason: "base_caida" }, { status: 503 });
  }
}
