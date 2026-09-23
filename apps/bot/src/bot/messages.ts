import { BUSINESS, formatCOP, type PaymentMethod } from "@sistema/shared";

/**
 * Todo el texto que lee el cliente, en un solo sitio.
 *
 * El tono se ajusta acá sin tocar el motor. Un mensaje incrustado en la
 * lógica es un mensaje que nadie vuelve a revisar. Tutea y usa "veci" con
 * moderación: es el registro de un domicilio de barrio, no el de un banco.
 */

const b = BUSINESS;

export const MESSAGES = {
  /**
   * Bienvenida del primer contacto.
   *
   * Dice explícitamente *cómo* se pide, no solo "hola": el cliente que llega
   * por primera vez no sabe que el pedido se arma en el menú y se envía desde
   * ahí, y esa es justo la mecánica que sostiene todo el sistema (ADR-02).
   */
  greeting: () =>
    `¡Bienvenido a *${b.name}*! 👋\n\n` +
    `Para hacer tu domicilio, entra al menú, arma tu pedido y me lo envías desde ahí. ` +
    `Yo te confirmo por acá la dirección y el pago.`,

  menuLink: () =>
    `Acá está el menú 👇 Agrega lo que quieras y me lo envías desde ahí.`,

  howToOrder: () =>
    `Es rápido, veci:\n\n` +
    `1️⃣ Abres el menú y agregas lo que quieras.\n` +
    `2️⃣ Le das *Enviar pedido* y me llega acá.\n` +
    `3️⃣ Me confirmas la dirección y cómo pagas.\n\n` +
    `Y listo, sale para allá.`,

  help: () => `Claro que sí, yo te ayudo. ¿Con qué necesitas?`,

  businessInfo: () =>
    `Horario: ${b.hours}\n` +
    `Domicilio: ${formatCOP(b.deliveryFee)} · llega en ${b.deliveryTime}\n` +
    `Pedido mínimo: ${formatCOP(b.minOrder)}\n` +
    `${b.zone}\n` +
    `Pagos: transferencia (Nequi ${b.payments.nequi}) o efectivo.`,

  // --- Pedido -------------------------------------------------------------

  orderReceived: (code: string, total: number, items: string[]) =>
    `¡Listo! Recibí tu pedido *${code}* 🎉\n\n` +
    items.map((line) => `• ${line}`).join("\n") +
    `\n\nProductos: ${formatCOP(total)}\n` +
    `Domicilio: ${formatCOP(b.deliveryFee)}\n` +
    `*Total: ${formatCOP(total + b.deliveryFee)}*\n\n` +
    `¿A qué dirección te lo llevo?`,

  askAddressAgain: () =>
    `Necesito la dirección completa para poder despacharlo. ` +
    `Escríbela con el barrio y algún punto de referencia.`,

  askPayment: (address: string) =>
    `Perfecto, anoté: *${address}*\n\n¿Cómo vas a pagar?`,

  orderConfirmedCash: (code: string, total: number) =>
    `¡Listo! Tu pedido *${code}* ya entró a cocina 👨‍🍳\n\n` +
    `Pagas ${formatCOP(total + b.deliveryFee)} en efectivo cuando llegue.\n` +
    `Llega en ${b.deliveryTime}. Te voy avisando.`,

  orderConfirmedTransfer: (code: string, total: number) =>
    `¡Listo! Tu pedido *${code}* ya entró a cocina 👨‍🍳\n\n` +
    `Transfiere ${formatCOP(total + b.deliveryFee)} a *Nequi ${b.payments.nequi}* ` +
    `y mándame el comprobante por acá.\n` +
    `Llega en ${b.deliveryTime}. Te voy avisando.`,

  /**
   * Confirmación cuando el pedido llegó COMPLETO desde el menú (con nombre,
   * dirección y pago ya elegidos).
   *
   * Es un mensaje solo, no una conversación: no queda nada que preguntar, así
   * que se le repite todo lo que anotamos para que pueda corregir si algo
   * quedó mal, y se le dice exactamente qué sigue según cómo vaya a pagar.
   */
  orderConfirmedFull: (params: {
    code: string;
    name: string | null;
    address: string;
    total: number;
    method: PaymentMethod;
    items: string[];
  }) => {
    const total = formatCOP(params.total + b.deliveryFee);

    const payment =
      params.method === "efectivo"
        ? `💵 Pagas *${total}* en efectivo cuando llegue.`
        : params.method === "datafono"
          ? `💳 Pagas *${total}* con tarjeta cuando llegue — el domiciliario lleva el datáfono.`
          : `🏦 Transfiere *${total}* a *Nequi ${b.payments.nequi}* ` +
            `(o ${b.payments.bank}) y mándame el comprobante por acá.`;

    return (
      `¡Pedido confirmado! *${params.code}* 🎉\n\n` +
      params.items.map((line) => `• ${line}`).join("\n") +
      `\n\nProductos: ${formatCOP(params.total)}\n` +
      `Domicilio: ${formatCOP(b.deliveryFee)}\n` +
      `*Total: ${total}*\n\n` +
      (params.name ? `👤 ${params.name}\n` : "") +
      `📍 ${params.address}\n\n` +
      `${payment}\n\n` +
      `Ya entró a cocina, llega en ${b.deliveryTime}. Te voy avisando 🛵`
    );
  },

  orderAlreadyRedeemed: (code: string) =>
    `Ese pedido (*${code}*) ya lo tengo en curso. Si quieres pedir algo más, ` +
    `ármalo en el menú y me lo envías como un pedido nuevo.`,

  orderNotFound: () =>
    `No encuentro ese código. Revisa que esté bien escrito, o ármalo de nuevo ` +
    `en el menú y me lo envías desde ahí.`,

  orderItemsGone: () =>
    `Se me agotó todo lo de ese pedido mientras lo armabas 😔 ` +
    `Ábrelo de nuevo y elige otra cosa.`,

  /**
   * El candado de ADR-02, dicho como una salida y no como un error técnico.
   * Se ve cuando alguien intenta cerrar un pedido que nunca nació del menú.
   */
  ordersOnlyFromMenu: () =>
    `Los pedidos se arman en el menú, así no se me pasa nada ni te mando lo ` +
    `que no era. Ábrelo, agrega lo tuyo y me lo envías desde ahí 👇`,

  // --- Comprobante de pago --------------------------------------------------

  voucherReceived: () =>
    `Recibí tu comprobante, dame un momentico para revisarlo 🧾`,

  voucherValidated: (code: string) =>
    `¡Todo cuadra! Tu pago del pedido *${code}* quedó confirmado ✅`,

  voucherInReview: () =>
    `Tu pedido ya está registrado, pero el comprobante necesita que alguien del ` +
    `equipo lo revise a mano. En un momento te confirman.`,

  voucherDuplicateReference: () =>
    `Esa referencia de transferencia ya se usó en otro pedido. Si crees que es ` +
    `un error, dime y lo revisa una persona.`,

  // --- Supervisión ----------------------------------------------------------

  escalated: () =>
    `Dame un momentico, ya te contesta una persona del equipo 🙋`,

  escalatedByBot: () =>
    `Esa no te la sé responder bien, y prefiero no inventarte nada. ` +
    `Ya le avisé a una persona del equipo para que te ayude 🙋`,

  botResumed: () =>
    `Listo, vuelvo a atenderte yo. ¿En qué te ayudo?`,

  // --- Degradación ------------------------------------------------------------

  /** RF-17: si el modelo falla, nunca silencio. */
  llmUnavailable: () =>
    `Perdón, no te entendí bien esa. Mira el menú y me dices qué se te antoja 👇`,

  /** RF-14: si no se pudo transcribir la nota de voz (o Whisper no está
   *  configurado todavía — mismo mensaje, es indistinguible para el cliente). */
  voiceUnavailable: () =>
    `No pude escuchar tu audio. ¿Me lo escribes, o prefieres ver el menú?`,

  /** Fase 5 (voucher.ts) todavía no lee imágenes. Honesto en vez de fingir
   *  que se está revisando algo que nadie va a mirar. */
  imageUnavailable: () =>
    `Por ahora no puedo leer imágenes. ¿En qué más te ayudo?`,

  /** Sticker, ubicación, contacto — tipos que WhatsApp permite y no atendemos. */
  unsupportedMessage: () =>
    `Ese tipo de mensaje no lo puedo leer. ¿Me escribes lo que necesitas?`,

  /** RF-18: tope de mensajes por hora. */
  rateLimited: () =>
    `Has escrito bastante en la última hora 🙂 dame un momentico y seguimos.`,

  outOfHours: () =>
    `Ya cerramos por hoy. Nuestro horario es ${b.hours}. ` +
    `¡Te esperamos mañana!`,
};

/** Etiquetas de los botones. Cortas: WhatsApp las corta a 20 caracteres. */
export const BUTTONS = {
  payCash: { id: "pay_efectivo", title: "Efectivo" },
  payTransfer: { id: "pay_transferencia", title: "Transferencia" },
  helpHowTo: { id: "help_como_pedir", title: "Cómo pedir" },
  helpFaq: { id: "help_faq", title: "Preguntas" },
  helpHuman: { id: "help_persona", title: "Hablar con alguien" },
};
