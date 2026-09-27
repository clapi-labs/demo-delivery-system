"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type PointerEvent } from "react";

import { formatCOP, formatPhone } from "@sistema/shared";

import {
  ArrowRightIcon,
  CancelIcon,
  ChatIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  MapIcon,
  PhoneIcon,
  PinIcon,
} from "@/components/icons";
import { StatusBadge } from "@/components/ui";
import { categoryImage } from "@/lib/category-images";
import { useMedia } from "@/lib/use-media";
import {
  ADVANCE_LABEL,
  ORDER_STATUS_LABEL,
  STATUS_TONE,
  customerLabel,
  elapsedLabel,
  isActive,
  minutesBetween,
  nextOrderStatus,
  paymentLabel,
  urgency,
  type OrderStatus,
  type PortalOrder,
  type PortalOrderLine,
} from "@/lib/orders";

type Props = {
  order: PortalOrder;
  now: number | null;
  fresh?: boolean;
  /** Abrir el detalle al montar (llegando desde "Ver detalle"). */
  defaultExpanded?: boolean;
  onAdvance: (order: PortalOrder) => void;
  onSetStatus: (order: PortalOrder, status: OrderStatus) => void;
};

/** Qué fracción del ancho hay que deslizar para que cuente. */
const SWIPE_THRESHOLD = 0.35;

const TIMER_STYLE = {
  ok: "bg-idle-soft text-idle-ink",
  warn: "bg-warn-soft text-warn-ink",
  late: "bg-danger-soft text-danger-ink",
} as const;

/**
 * Los dos botones del detalle: misma forma, distinto tinte.
 *
 * Blancos con anillo de color y sombra corta — antes eran una pastilla y un
 * enlace subrayado, y nadie los leía como botones. Cada uno va **al lado del
 * dato que abre** (la dirección, el teléfono) y solo baja a su propia línea,
 * a lo ancho, cuando la tarjeta es angosta: `w-full` en un contenedor
 * `flex-wrap` fuerza el salto de línea sin un segundo juego de marcado.
 *
 * El anillo se escribe completo en cada variante en vez de sobreescribir uno
 * base: dos clases que fijan `--tw-ring-color` se resuelven por el orden de la
 * hoja de estilos, no por el orden del `className`, así que "la última gana"
 * no es cierto acá.
 */
const DETAIL_BUTTON =
  "ease-ui inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-surface px-2.5 text-xs font-medium shadow-sm ring-1 active:scale-[0.98] sm:h-8 sm:w-auto";

/** El rótulo de cada bloque del detalle. */
const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-wide text-ink-3";

/** Un bloque blanco sobre el panel gris del detalle. */
const SECTION_BOX = "rounded-lg bg-surface p-3 shadow-sm ring-1 ring-black/5";

/**
 * La comanda: un pedido tal como lo necesita la cocina.
 *
 * Tres formas de avanzarlo, todas a un solo gesto: el botón (siempre), deslizar
 * a la derecha con el dedo (celular) y arrastrarlo a la siguiente columna
 * (escritorio). Tocar la tarjeta despliega el detalle ahí mismo, sin abrir
 * otra pantalla.
 */
export function OrderTicket({ order, now, fresh, defaultExpanded, onAdvance, onSetStatus }: Props) {
  const [expanded, setExpanded] = useState(!!defaultExpanded);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [width, setWidth] = useState(320);
  const canDrag = useMedia("(pointer: fine)");

  const cardRef = useRef<HTMLElement>(null);
  const gesture = useRef<{ x: number; y: number; axis: "h" | "v" | null; width: number } | null>(null);
  const suppressClick = useRef(false);
  const crossed = useRef(false);

  const next = nextOrderStatus(order.status);
  const active = isActive(order.status);
  const minutes = now ? minutesBetween(order.createdAt, now) : null;
  const level = minutes !== null && active ? urgency(order.status, minutes) : "ok";
  const tone = STATUS_TONE[order.status];
  const nextTone = next ? STATUS_TONE[next] : null;
  const progress = Math.min(1, dx / (width * SWIPE_THRESHOLD));

  // --- Deslizar (solo dedo) ----------------------------------------------------

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "touch" || !next || !active) return;
    const cardWidth = cardRef.current?.offsetWidth ?? 320;
    gesture.current = { x: e.clientX, y: e.clientY, axis: null, width: cardWidth };
    setWidth(cardWidth);
    crossed.current = false;
  };

  const onPointerMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const moveX = e.clientX - g.x;
    const moveY = e.clientY - g.y;

    // Primero se decide el eje: si el dedo va más para abajo que para el
    // lado, es un scroll y la tarjeta no se mueve.
    if (!g.axis) {
      if (Math.abs(moveX) > 10 && Math.abs(moveX) > Math.abs(moveY) * 1.2) {
        g.axis = "h";
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else if (Math.abs(moveY) > 10) {
        g.axis = "v";
      }
    }
    if (g.axis !== "h") return;

    const offset = Math.max(0, moveX);
    setDx(offset);
    const past = offset > g.width * SWIPE_THRESHOLD;
    if (past !== crossed.current) {
      crossed.current = past;
      if (past) navigator.vibrate?.(12);
    }
  };

  const endGesture = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.axis !== "h") return;
    suppressClick.current = true;

    if (dx > g.width * SWIPE_THRESHOLD) {
      setLeaving(true);
      setDx(g.width + 24);
      setTimeout(() => {
        onAdvance(order);
        setLeaving(false);
        setDx(0);
      }, 180);
    } else {
      setDx(0);
    }
  };

  const toggle = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setExpanded((v) => !v);
    setConfirmCancel(false);
  };

  const swiping = dx > 0;

  return (
    <div className="relative">
      {/* Lo que aparece detrás al deslizar: a dónde va el pedido. */}
      {next && nextTone && active ? (
        <div
          aria-hidden="true"
          className={`ease-ui absolute inset-0 flex items-center gap-2 rounded-xl px-5 text-sm font-semibold ${
            progress >= 1 ? `${nextTone.dot} text-white` : `${nextTone.soft} ${nextTone.ink}`
          } ${swiping ? "opacity-100" : "opacity-0"}`}
        >
          {progress >= 1 ? <CheckIcon className="h-5 w-5" /> : <ArrowRightIcon className="h-5 w-5" />}
          {ORDER_STATUS_LABEL[next]}
        </div>
      ) : null}

      <article
        ref={cardRef}
        draggable={canDrag && active}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/order-id", String(order.id));
          e.dataTransfer.effectAllowed = "move";
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: swiping && !leaving ? "none" : "transform 180ms ease-out, box-shadow 200ms ease-in-out",
          touchAction: "pan-y",
        }}
        className={`card relative overflow-hidden hover:shadow-md ${fresh ? "outline-2 outline-brand/60" : ""} ${
          canDrag && active ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        <span className={`absolute inset-y-0 left-0 w-[3px] ${tone.dot}`} aria-hidden="true" />

        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
          className="block w-full cursor-pointer select-none py-3.5 pl-5 pr-4 text-left outline-none focus-visible:bg-sunken"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-title">{customerLabel(order)}</p>
              <p className="mt-0.5 font-mono text-xs text-ink-3">#{order.code}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {active ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${TIMER_STYLE[level]}`}
                  title="Tiempo desde que entró el pedido"
                >
                  <ClockIcon className="h-3.5 w-3.5" />
                  {minutes === null ? "—" : elapsedLabel(minutes)}
                </span>
              ) : null}
              {!active ? <StatusBadge status={order.status} /> : null}
            </div>
          </div>

          <div className="mt-3 border-t border-dashed border-line pt-3">
            <ItemLines items={order.items} expanded={expanded} />
          </div>

          {order.address && !expanded ? (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-2">
              <PinIcon className="h-3.5 w-3.5 shrink-0 text-ink-3" />
              {/* `min-w-0` es lo que deja que `truncate` recorte de verdad:
                  sin él, la dirección en una línea es el ancho mínimo del
                  párrafo y estiraba la tarjeta más allá de la pantalla. */}
              <span className="min-w-0 truncate">{order.address}</span>
            </p>
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              {/* El panel va en gris sólido (antes `bg-sunken/60`, casi del
                  color de la tarjeta) y por dentro en bloques blancos: así el
                  detalle se lee como una zona aparte y cada grupo de datos
                  queda separado del de al lado. */}
              <div className="space-y-3 border-t border-line bg-sunken py-4 pl-5 pr-4 text-sm">
                <section className={SECTION_BOX}>
                  <p className={SECTION_LABEL}>Entrega</p>
                  <div className="mt-2 space-y-2.5">
                    <div className="flex flex-wrap items-start gap-2">
                      <PinIcon className="h-4 w-4 shrink-0 translate-y-0.5 text-ink-3" />
                      <p className={`min-w-0 flex-1 ${order.address ? "font-medium text-ink" : "text-ink-3"}`}>
                        {order.address ?? "Dirección sin confirmar"}
                      </p>
                      {order.address ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className={`${DETAIL_BUTTON} text-maps-ink ring-maps/40 hover:bg-maps-soft`}
                        >
                          <MapIcon className="h-3.5 w-3.5" />
                          Abrir en el mapa
                        </a>
                      ) : null}
                    </div>
                    {order.phone ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <PhoneIcon className="h-4 w-4 shrink-0 text-ink-3" />
                        <a
                          href={`tel:+${order.phone}`}
                          className="flex-1 font-medium tabular-nums text-ink underline-offset-2 hover:underline"
                        >
                          {formatPhone(order.phone)}
                        </a>
                        <Link
                          href={`/conversaciones?tel=${order.phone}`}
                          className={`${DETAIL_BUTTON} text-whatsapp-ink ring-whatsapp/40 hover:bg-whatsapp-soft`}
                        >
                          <ChatIcon className="h-3.5 w-3.5" />
                          Ver chat
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className={SECTION_BOX}>
                  <p className={SECTION_LABEL}>Cuenta</p>
                  <dl className="mt-2 space-y-1 tabular-nums">
                    <div className="flex justify-between text-ink-2">
                      <dt>Subtotal</dt>
                      <dd>{formatCOP(order.subtotal)}</dd>
                    </div>
                    <div className="flex justify-between text-ink-2">
                      <dt>Domicilio</dt>
                      <dd>{formatCOP(order.deliveryFee)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-line pt-1.5 font-semibold text-ink">
                      <dt>Total</dt>
                      <dd>{formatCOP(order.total)}</dd>
                    </div>
                  </dl>
                </section>

                {order.status !== "cancelled" && order.status !== "delivered" ? (
                  confirmCancel ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 ring-1 ring-danger/20">
                      <p className="flex-1 font-medium text-danger-ink">¿Cancelar el pedido #{order.code}?</p>
                      <button
                        onClick={() => setConfirmCancel(false)}
                        className="ease-ui h-10 rounded-md px-3 font-medium text-ink-2 hover:bg-surface can-hover:h-8"
                      >
                        No
                      </button>
                      <button
                        onClick={() => onSetStatus(order, "cancelled")}
                        className="ease-ui h-10 rounded-md bg-danger px-3 font-medium text-white hover:brightness-95 can-hover:h-8"
                      >
                        Sí, cancelar
                      </button>
                    </div>
                  ) : (
                    // Ya no compite con cuatro pastillas de "Cambiar estado":
                    // es la única acción secundaria del detalle.
                    <button
                      onClick={() => setConfirmCancel(true)}
                      className="ease-ui inline-flex h-11 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-danger-ink hover:bg-danger-soft can-hover:h-9"
                    >
                      <CancelIcon className="h-4 w-4" />
                      Cancelar pedido
                    </button>
                  )
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <footer className="flex items-center gap-2 border-t border-line py-2.5 pl-5 pr-2.5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold tabular-nums tracking-title">{formatCOP(order.total)}</p>
            <p className={`truncate text-xs ${order.paymentMethod ? "text-ink-3" : "font-medium text-warn-ink"}`}>
              {paymentLabel(order.paymentMethod)}
            </p>
          </div>
          <button
            onClick={toggle}
            aria-label={expanded ? "Ocultar detalle" : "Ver detalle"}
            className="ease-ui shrink-0 rounded-full p-2.5 text-ink-3 hover:bg-sunken hover:text-ink can-hover:p-2"
          >
            <ChevronDownIcon className={`ease-ui h-5 w-5 ${expanded ? "rotate-180" : ""}`} />
          </button>
          {next && active ? (
            <button
              onClick={() => onAdvance(order)}
              className="ease-ui inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-ink pl-3.5 pr-3 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 active:scale-[0.97] can-hover:h-10"
            >
              {ADVANCE_LABEL[order.status as keyof typeof ADVANCE_LABEL]}
              <span className={`h-2 w-2 rounded-full ${nextTone?.dot}`} aria-hidden="true" />
            </button>
          ) : null}
        </footer>
      </article>
    </div>
  );
}

/**
 * Los renglones del pedido, con la foto del producto.
 *
 * Es la misma lista cerrada y abierta: al abrir el detalle la foto crece y
 * aparecen la categoría y el total de la línea. La foto va a la **derecha**,
 * pegada al borde de la tarjeta — a la izquierda empujaría el nombre y las
 * opciones a una columna angosta, que es justo lo que se estaba cortando en el
 * celular.
 */
function ItemLines({ items, expanded }: { items: PortalOrderLine[]; expanded: boolean }) {
  return (
    <ul className={expanded ? "space-y-3" : "space-y-2"}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          {/* `min-w-0` obligatorio: sin él el nombre largo fija el ancho
              mínimo del renglón y vuelve a estirar la tarjeta. */}
          <div className="min-w-0 flex-1">
            {expanded && item.categoryName ? <p className={SECTION_LABEL}>{item.categoryName}</p> : null}
            <p className="flex gap-1.5 text-sm leading-snug">
              <span className="shrink-0 font-semibold tabular-nums text-ink">{item.quantity}×</span>
              <span className="min-w-0 font-medium text-ink">{item.name}</span>
            </p>
            {item.options.length > 0 ? (
              <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
                {item.options.map((o) => o.name).join(" · ")}
              </p>
            ) : null}
            {expanded ? (
              <p className="mt-1 text-[13px] font-medium tabular-nums text-ink-2">{formatCOP(item.lineTotal)}</p>
            ) : null}
          </div>
          <ItemPhoto item={item} expanded={expanded} />
        </li>
      ))}
    </ul>
  );
}

/**
 * La foto de un renglón.
 *
 * Si el producto tiene foto propia se usa esa; si no, la misma foto de
 * categoría que ve el cliente en el menú público (`categoryImage`). Un renglón
 * cuyo producto ya no existe en el catálogo no tiene categoría: cae en la foto
 * genérica y no se rompe.
 */
function ItemPhoto({ item, expanded }: { item: PortalOrderLine; expanded: boolean }) {
  return (
    <div
      className={`ease-ui shrink-0 overflow-hidden rounded-lg bg-sunken ring-1 ring-black/5 ${
        expanded ? "h-14 w-14" : "h-10 w-10"
      }`}
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- el catálogo es dinámico; next/image exige dominios remotos conocidos de antemano.
        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <Image
          src={categoryImage(item.categorySlug ?? "")}
          alt=""
          placeholder="blur"
          sizes="56px"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
