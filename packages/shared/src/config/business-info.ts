/**
 * Datos del negocio.
 *
 * Una sola fuente: la usa el prompt del asistente, el pie del menú y la
 * pantalla de preguntas frecuentes. En el sistema real esto sale del `.env`
 * por la misma razón — que el dato no viva en dos sitios que se
 * desincronizan.
 *
 * Los valores por defecto son de relleno; los reales van en `.env.local`.
 */

function env(key: string, fallback: string) {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}

export const BUSINESS = {
  name: env("BUSINESS_NAME", "Brasa & Pan"),
  /** Una línea, para el héroe del menú. Opcional a propósito: sin ella el
   *  héroe se queda solo con el horario y la dirección. */
  tagline: env("BUSINESS_TAGLINE", ""),
  /**
   * **La demo atiende 24/7 a propósito.**
   *
   * El candado de fuera de horario (RF-12) está hecho y verificado
   * (`verify-orchestrator`), pero con horario real el bot deja de contestar a
   * las 10 p.m. — justo cuando se graba el video o cuando el prospecto se
   * anima a probarlo desde su celular. Lo único que lograba en ese escenario
   * era tapar todo lo demás.
   *
   * No se borró nada: el corte sigue en el código. Para volver al horario de
   * un restaurante real basta con poner estas tres variables en el entorno
   * (ver `.env.example`), sin tocar una línea.
   */
  hours: env("BUSINESS_HOURS", "Todos los días, 24 horas"),
  /** Horario en formato 24 h para la comprobación automática. */
  opensAt: envInt("BUSINESS_OPENS_HOUR", 0),
  closesAt: envInt("BUSINESS_CLOSES_HOUR", 24),
  timezone: env("BUSINESS_TIMEZONE", "America/Bogota"),

  deliveryFee: envInt("DELIVERY_FEE", 5000),
  deliveryTime: env("DELIVERY_TIME", "30 a 45 minutos"),
  minOrder: envInt("MIN_ORDER", 20000),
  zone: env("DELIVERY_ZONE", "Cobertura de domicilio en un radio de 4 km."),
  address: env("BUSINESS_ADDRESS", ""),

  /** El número real, sin `+` ni espacios. Solo lo usa el menú, para el link
   *  de respaldo cuando el pedido no vuelve solo a WhatsApp (RF-27). */
  whatsappNumber: env("BUSINESS_WHATSAPP_NUMBER", ""),

  payments: {
    cash: true,
    transfer: true,
    nequi: env("PAYMENT_NEQUI", "300 123 4567"),
    bank: env("PAYMENT_BANK", "Bancolombia ahorros 123-456789-00"),
  },
} as const;

/**
 * ¿Está abierto ahora?
 *
 * Fuera de horario el asistente contesta el horario y **no llama al modelo ni
 * ofrece el menú**: tomar un pedido que nadie va a preparar es peor que no
 * contestar.
 */
export function isOpenNow(now: Date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS.timezone,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );

  return hour >= BUSINESS.opensAt && hour < BUSINESS.closesAt;
}

/**
 * ¿El negocio no cierra nunca?
 *
 * Lo preguntan las pantallas que muestran "cierra a las X": con 0–24 esa
 * frase sale como "cierra a las 12 a.m.", que se lee como un error. Cuando
 * esto es cierto dicen "24 horas" y ya.
 */
export function isAlwaysOpen() {
  return BUSINESS.opensAt <= 0 && BUSINESS.closesAt >= 24;
}
