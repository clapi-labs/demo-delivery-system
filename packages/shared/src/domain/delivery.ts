import { BUSINESS } from "../config/business-info";
import { formatCOP, formatPhone } from "./format";
import type { PaymentMethod } from "./payment";

/**
 * Quién lleva el pedido: el módulo de asignación logística.
 *
 * El restaurante trabaja de dos maneras a la vez y el sistema no puede
 * obligarlo a elegir una:
 *
 * - **Propio** (`internal`): un domiciliario de la casa. El sistema le manda
 *   la ficha por WhatsApp y él marca la entrega desde su celular.
 * - **Agencia** (`agency`): una flota externa (tipo Bejarano) a la que el
 *   cajero le escribe por su propio WhatsApp. Ahí el sistema **no manda
 *   nada**: redacta la ficha y abre el chat con el texto puesto (ver
 *   `whatsappLink`). Esa es la decisión de fondo, y está en ADR-12.
 *
 * Los textos viven acá, en `shared`, por lo mismo que `orderStatusMessage`:
 * los escribe el **portal** (el link `wa.me`, el botón de copiar) y los manda
 * el **bot** (el aviso al domiciliario propio). Si vivieran en uno, el otro
 * tendría que adivinarlos.
 */

export type CourierKind = "internal" | "agency";

/**
 * Cómo cobra una flota externa lo que recoge.
 *
 * - `cash_base`: el mensajero lleva base y cobra al cliente en la puerta, así
 *   que hay que decirle **cuánto exacto** o llega sin cambio.
 * - `account`: va a la cuenta que se liquida con la agencia; el mensajero no
 *   toca dinero del cliente.
 */
export type CourierPayment = "cash_base" | "account";

export const COURIER_KIND_LABEL: Record<CourierKind, string> = {
  internal: "Domiciliario propio",
  agency: "Flota externa",
};

export const COURIER_PAYMENT_LABEL: Record<CourierPayment, string> = {
  cash_base: "Exige base en efectivo",
  account: "A cuenta de la agencia",
};

/** Lo mínimo que hace falta saber de quién reparte para redactar la ficha. */
export type CourierRef = {
  name: string;
  phone: string;
  kind: CourierKind;
};

/** El pedido, visto desde la logística: solo lo que el mensajero necesita. */
export type DeliveryOrder = {
  code: string;
  customerName: string | null;
  phone: string | null;
  address: string | null;
  addressNotes: string | null;
  total: number;
  paymentMethod: PaymentMethod | null;
  items: { quantity: number; name: string }[];
};

/**
 * El enlace del mapa.
 *
 * Es una búsqueda por texto, no unas coordenadas: el sistema nunca geocodifica
 * la dirección. Lo que el cliente escribió es lo que el mensajero va a leer, y
 * una coordenada mal adivinada lo manda a la cuadra equivocada con más
 * confianza que una dirección a medias.
 */
export function mapsLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/**
 * Abrir un chat de WhatsApp con el mensaje ya escrito.
 *
 * **Es el atajo que hace que todo esto funcione con una agencia externa.** El
 * cajero toca el botón y le sale el chat de la agencia con la ficha completa
 * en la barra de mensajes; solo tiene que darle enviar. Pasa de dos minutos
 * escribiendo una dirección a un toque.
 *
 * Sale del WhatsApp personal del restaurante a propósito: la línea de la Cloud
 * API está dedicada al bot que atiende a los clientes, y un negocio no puede
 * chatear a mano desde ella (ADR-12).
 */
export function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** "2× Doble Tocineta, 1× Gaseosa" */
function itemLine(order: DeliveryOrder) {
  return order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
}

/**
 * Qué se le dice al mensajero sobre el dinero.
 *
 * Es la línea que más cuesta cuando falta: un mensajero que llega sin saber
 * que cobra en efectivo vuelve al local, y el cliente espera el doble.
 */
function moneyLine(order: DeliveryOrder, payment: CourierPayment | null) {
  if (payment === "account") {
    return `💳 NO cobrar al cliente. Este va a cuenta de la agencia.`;
  }
  if (order.paymentMethod === "efectivo" || order.paymentMethod === null) {
    const sure = order.paymentMethod ? "" : " (pago sin confirmar: confírmalo antes de salir)";
    return `💵 Cobrar al cliente: *${formatCOP(order.total)}* en efectivo${sure}. Lleva base para el cambio.`;
  }
  return `💳 Ya pagó por ${order.paymentMethod}. NO cobrar nada al cliente.`;
}

/**
 * La ficha del pedido: el texto que se le manda a quien lo lleva.
 *
 * Una sola plantilla para los dos casos, con la dirección de recogida solo
 * cuando hace falta —un domiciliario de la casa ya está en el local— y el
 * teléfono del cliente siempre, porque el portero no contesta y la moto se
 * queda esperando abajo.
 */
export function dispatchTicket(
  order: DeliveryOrder,
  courier: CourierRef,
  payment: CourierPayment | null = null,
  /** De dónde recoge la agencia. Parámetro para poder probarlo; por defecto,
   *  la dirección del negocio. */
  pickup: string = BUSINESS.address,
): string {
  const lines = [`📦 *DOMICILIO ${order.code}* · ${BUSINESS.name}`, ""];

  // A una flota externa hay que decirle dónde recoger, siempre. Si no hay
  // dirección configurada se dice **en la ficha** en vez de omitir la línea:
  // el cajero la lee antes de enviarla y así se entera de lo que falta, en
  // vez de que el mensajero llame preguntando a dónde va.
  if (courier.kind === "agency") {
    lines.push(`📍 Recoger en: ${pickup || "⚠️ falta configurar la dirección del negocio"}`);
  }

  lines.push(`🏁 Entregar en: ${order.address ?? "SIN DIRECCIÓN — confirmar con el local"}`);
  if (order.addressNotes) lines.push(`📝 ${order.addressNotes}`);

  lines.push(
    `👤 Cliente: ${order.customerName ?? "Sin nombre"}${order.phone ? ` (${formatPhone(order.phone)})` : ""}`,
  );
  lines.push("");
  lines.push(`🍔 ${itemLine(order)}`);
  lines.push(moneyLine(order, payment));

  if (order.address) {
    lines.push("");
    lines.push(`🗺️ ${mapsLink(order.address)}`);
  }

  return lines.join("\n");
}

/**
 * El aviso que le llega al domiciliario propio por WhatsApp.
 *
 * Es la ficha con una línea más: el enlace a su pantalla, donde marca la
 * entrega sin llamar al local. **Sale por `apps/bot`** como todo lo demás
 * (RN-05), así que depende de la ventana de 24 h: si el domiciliario nunca le
 * escribió al bot, Meta rechaza el mensaje y el portal cae al mismo atajo
 * `wa.me` de las agencias. Eso no es un error del sistema, es cómo funciona la
 * Cloud API.
 */
export function courierBrief(order: DeliveryOrder, courier: CourierRef, driverUrl?: string): string {
  const ticket = dispatchTicket(order, courier);
  if (!driverUrl) return ticket;
  return `${ticket}\n\n✅ Marca la entrega acá: ${driverUrl}`;
}
