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
  name: env("BUSINESS_NAME", "Sabor Urbano"),
  hours: env("BUSINESS_HOURS", "Lunes a domingo, 11:00 a.m. a 10:00 p.m."),
  /** Horario en formato 24 h para la comprobación automática. */
  opensAt: envInt("BUSINESS_OPENS_HOUR", 11),
  closesAt: envInt("BUSINESS_CLOSES_HOUR", 22),
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
