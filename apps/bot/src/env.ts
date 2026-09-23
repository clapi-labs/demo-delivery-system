/**
 * Variables de entorno del bot.
 *
 * **Se validan al leerlas, no al importar el módulo.** La diferencia importa:
 * en serverless no hay un "arranque" donde fallar, y Next evalúa los módulos
 * durante el build — así que validar arriba del archivo hace imposible
 * compilar sin tener todos los secretos a mano, incluso en CI.
 *
 * Con getters, cada lectura falla con un mensaje que nombra la variable que
 * falta, y eso ocurre atendiendo un request, que es cuando de verdad importa.
 * `assertEnv()` está para comprobarlas todas de golpe desde un healthcheck.
 */

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${key}. Ver .env.example y docs/DEPLOYMENT.md.`,
    );
  }
  return value;
}

function optional(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

/**
 * Una URL de otra app, tolerante a cómo se haya escrito la variable.
 *
 * **Esto no es cosmético, costó una demo en vivo:** `MENU_URL` se configuró
 * como `demo-delivery-system-menu.vercel.app`, sin `https://`. El bot armó el
 * botón del menú con esa cadena, WhatsApp la recibió como URL relativa y el
 * botón no abría nada — sin ningún error en ningún log, porque para el bot
 * todo había salido bien.
 *
 * Quien llena esa variable copia un host desde el panel de Vercel, que lo
 * muestra sin esquema. Exigir que se acuerde de anteponerlo es apostar a que
 * nadie se equivoque nunca; normalizarlo acá cuesta tres líneas.
 */
function requiredUrl(key: string): string {
  const value = required(key);
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, ""); // sin barra final: quien la use la agrega
}

export const env = {
  // --- Meta / WhatsApp Cloud API -----------------------------------------
  //
  // Dónde sale cada una (detalle en .env.example y docs/DEPLOYMENT.md §2):
  //
  //  PHONE_NUMBER_ID  → WhatsApp → API Setup → "Phone number ID"
  //  ACCESS_TOKEN     → NO el token temporal de la consola (dura 24 h).
  //                     Business Settings → System Users → Generate token.
  //  VERIFY_TOKEN     → una cadena que TÚ inventas, idéntica acá y en Meta.
  //  APP_SECRET       → Settings → Basic → App Secret. Firma cada webhook.
  whatsapp: {
    get phoneNumberId() {
      return required("WHATSAPP_PHONE_NUMBER_ID");
    },
    get accessToken() {
      return required("WHATSAPP_ACCESS_TOKEN");
    },
    get verifyToken() {
      return required("WHATSAPP_VERIFY_TOKEN");
    },
    get appSecret() {
      return required("WHATSAPP_APP_SECRET");
    },
    get apiVersion() {
      return optional("WHATSAPP_API_VERSION", "v21.0");
    },
  },

  openai: {
    get apiKey() {
      return required("OPENAI_API_KEY");
    },
    get chatModel() {
      return optional("OPENAI_CHAT_MODEL", "gpt-4o-mini");
    },
    /** Notas de voz. */
    get transcribeModel() {
      return optional("OPENAI_TRANSCRIBE_MODEL", "whisper-1");
    },
    /** Lectura de comprobantes de pago. */
    get visionModel() {
      return optional("OPENAI_VISION_MODEL", "gpt-4o-mini");
    },
  },

  // --- Enlaces entre apps -------------------------------------------------
  //
  // Las tres apps se despliegan por separado y se hablan por HTTP.
  // `internalSecret` protege los endpoints que disparan mensajes de WhatsApp:
  // uno abierto es un endpoint público que escribe en nombre del restaurante.
  urls: {
    get menu() {
      return requiredUrl("MENU_URL");
    },
    get portal() {
      const value = optional("PORTAL_URL");
      if (!value) return "";
      return (/^https?:\/\//i.test(value) ? value : `https://${value}`).replace(/\/+$/, "");
    },
  },
  get internalSecret() {
    return required("INTERNAL_SECRET");
  },

  /** Firma los links del menú. Idéntico en bot y menú, o el pedido no vuelve. */
  get menuTokenSecret() {
    return required("MENU_TOKEN_SECRET");
  },

  /**
   * Foto de la bienvenida. Opcional a propósito: sin ella el saludo sale
   * igual, solo sin imagen. Tiene que ser una URL PÚBLICA que sirva la
   * imagen directamente (Meta la descarga él mismo), no una página que la
   * muestre.
   */
  get welcomeImageUrl() {
    return optional("WELCOME_IMAGE_URL");
  },

  // --- Operación ----------------------------------------------------------
  get mediaDir() {
    return optional("MEDIA_DIR", "/tmp/media");
  },
  get maxMessagesPerHour() {
    return Number(optional("MAX_MESSAGES_PER_HOUR", "60"));
  },

  /**
   * El número de WhatsApp se comparte por rotación manual con otro bot
   * (Qanelo) — nunca los dos activos a la vez. Nginx decide a quién le
   * llegan los mensajes; esta variable es el candado de este lado para que,
   * si el bot queda con procesos corriendo mientras no es su turno (un cron
   * del outbox, un reintento en vuelo), no se le escape un solo mensaje al
   * número compartido. Por defecto **apagado**: hay que prenderlo a
   * propósito, nunca al revés.
   */
  get botActive() {
    return optional("BOT_ACTIVE", "false") === "true";
  },
};

/**
 * Comprueba todas las obligatorias de golpe.
 *
 * Para el healthcheck: un despliegue al que le falta una variable se ve
 * enseguida, en vez de descubrirse con el primer cliente que escriba.
 */
export function assertEnv(): { ok: boolean; missing: string[] } {
  const missing = [
    "DATABASE_URL",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_VERIFY_TOKEN",
    "WHATSAPP_APP_SECRET",
    "OPENAI_API_KEY",
    "MENU_URL",
    "INTERNAL_SECRET",
    "MENU_TOKEN_SECRET",
  ].filter((key) => !process.env[key]);

  return { ok: missing.length === 0, missing };
}
