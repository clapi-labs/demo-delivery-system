/**
 * Variables de entorno del portal.
 *
 * Con getters y no constantes, por la misma razón que en `apps/bot/src/env.ts`:
 * en serverless no hay un arranque donde fallar, y Next evalúa los módulos
 * durante el build. Leerlas al usarlas hace que falte una variable sea un
 * error atendiendo un request, no un build imposible.
 *
 * **Solo se puede importar desde el servidor** (rutas de API y componentes de
 * servidor). Un componente de cliente que lea esto se lleva cadenas vacías.
 */

function optional(key: string, fallback = "") {
  return process.env[key] ?? fallback;
}

/** Normaliza una URL escrita sin esquema, que es como la copia Vercel. */
function url(value: string) {
  if (!value) return "";
  return (/^https?:\/\//i.test(value) ? value : `https://${value}`).replace(/\/+$/, "");
}

export const env = {
  /** El bot: el único camino de salida a WhatsApp (RN-05). */
  get botUrl() {
    return url(optional("BOT_URL"));
  },
  get internalSecret() {
    return optional("INTERNAL_SECRET");
  },

  /**
   * Firma el link de la pantalla del repartidor.
   *
   * Cae en `MENU_TOKEN_SECRET` para no obligar a configurar una variable más
   * en un despliegue que ya funciona: los dos firman lo mismo —un enlace que
   * viaja por WhatsApp— y el portal ya comparte entorno con el resto. Si no
   * hay ninguno, el portal **no inventa un link sin firmar**: dice en pantalla
   * lo que falta.
   */
  get courierTokenSecret() {
    return optional("COURIER_TOKEN_SECRET") || optional("MENU_TOKEN_SECRET");
  },

  /**
   * La URL pública del portal, para el link del repartidor.
   *
   * Opcional: si no está, se deduce de la cabecera `host` del request, que en
   * Vercel es la correcta. La variable existe para cuando el portal vive
   * detrás de un dominio propio y se quiere fijar.
   */
  get portalUrl() {
    return url(optional("PORTAL_URL"));
  },
};

/**
 * Le pide algo al bot por HTTP.
 *
 * Devuelve `null` si falta la configuración, y el motivo que dé el bot si
 * responde mal. **Nunca lanza**: ninguna de las cosas que se le piden al bot
 * puede tumbar una operación del portal (mover una comanda, asignar un
 * repartidor). Quien llama decide qué contar en pantalla.
 */
export async function askBot(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; reason?: string } | null> {
  if (!env.botUrl || !env.internalSecret) return null;

  try {
    const res = await fetch(`${env.botUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.internalSecret}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
    return { ok: res.ok && data?.ok !== false, reason: data?.reason };
  } catch (error) {
    console.error(`[portal] no se pudo hablar con el bot (${path}):`, error);
    return { ok: false, reason: "failed" };
  }
}
