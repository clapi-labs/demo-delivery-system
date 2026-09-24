"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRef, useState, type PointerEvent } from "react";

import { formatCOP, formatPhone } from "@sistema/shared";

import {
  ArrowRightIcon,
  ChatIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  PhoneIcon,
  PinIcon,
} from "@/components/icons";
import { StatusBadge } from "@/components/ui";
import { useMedia } from "@/lib/use-media";
import {
  ADVANCE_LABEL,
  ORDER_STATUS_FLOW,
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
} from "@/lib/orders";

type Props = {
  order: PortalOrder;
  now: number | null;
  fresh?: boolean;
  /** Mostrar el estado en la tarjeta (cuando la columna no lo dice ya). */
  showStatus?: boolean;
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
 * La comanda: un pedido tal como lo necesita la cocina.
 *
 * Tres formas de avanzarlo, todas a un solo gesto: el botón (siempre), deslizar
 * a la derecha con el dedo (celular) y arrastrarlo a la siguiente columna
 * (escritorio). Tocar la tarjeta despliega el detalle ahí mismo, sin abrir
 * otra pantalla.
 */
export function OrderTicket({ order, now, fresh, showStatus, defaultExpanded, onAdvance, onSetStatus }: Props) {
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
              {showStatus || !active ? <StatusBadge status={order.status} /> : null}
            </div>
          </div>

          <ul className="mt-3 space-y-1.5 border-t border-dashed border-line pt-3">
            {order.items.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm leading-snug">
                <span className="w-6 shrink-0 font-semibold tabular-nums text-ink">{item.quantity}×</span>
                <span className="min-w-0">
                  {item.name}
                  {item.options.length > 0 ? (
                    <span className="block text-[13px] text-ink-3">{item.options.map((o) => o.name).join(", ")}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          {order.address && !expanded ? (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-2">
              <PinIcon className="h-3.5 w-3.5 shrink-0 text-ink-3" />
              <span className="truncate">{order.address}</span>
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
              <div className="space-y-4 border-t border-line bg-sunken/60 py-4 pl-5 pr-4 text-sm">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <PinIcon className="h-4 w-4 shrink-0 translate-y-0.5 text-ink-3" />
                    <div className="min-w-0">
                      <p>{order.address ?? "Dirección sin confirmar"}</p>
                      {order.address ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-ink underline-offset-2 hover:underline"
                        >
                          Abrir en el mapa
                        </a>
                      ) : null}
                    </div>
                  </div>
                  {order.phone ? (
                    <div className="flex items-center gap-2">
                      <PhoneIcon className="h-4 w-4 shrink-0 text-ink-3" />
                      <a href={`tel:+${order.phone}`} className="tabular-nums underline-offset-2 hover:underline">
                        {formatPhone(order.phone)}
                      </a>
                      <Link
                        href={`/conversaciones?tel=${order.phone}`}
                        className="ease-ui ml-auto inline-flex h-9 items-center gap-1 rounded-full bg-whatsapp-soft px-3 text-xs font-medium text-whatsapp-ink hover:brightness-95 can-hover:h-7 can-hover:px-2.5"
                      >
                        <ChatIcon className="h-3.5 w-3.5" />
                        Ver chat
                      </Link>
                    </div>
                  ) : null}
                </div>

                <dl className="space-y-1 border-t border-line pt-3 tabular-nums">
                  <div className="flex justify-between text-ink-2">
                    <dt>Subtotal</dt>
                    <dd>{formatCOP(order.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between text-ink-2">
                    <dt>Domicilio</dt>
                    <dd>{formatCOP(order.deliveryFee)}</dd>
                  </div>
                </dl>

                <div className="border-t border-line pt-3">
                  <p className="text-xs font-medium text-ink-2">Cambiar estado</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ORDER_STATUS_FLOW.map((s) => {
                      const current = s === order.status;
                      return (
                        <button
                          key={s}
                          onClick={() => onSetStatus(order, s)}
                          disabled={current}
                          className={`ease-ui inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium can-hover:h-7 ${
                            current
                              ? `${STATUS_TONE[s].soft} ${STATUS_TONE[s].ink}`
                              : "bg-surface text-ink-2 shadow-sm ring-1 ring-black/10 hover:text-ink"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_TONE[s].dot}`} />
                          {ORDER_STATUS_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {order.status !== "cancelled" && order.status !== "delivered" ? (
                  confirmCancel ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-danger-soft px-3 py-2">
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
                    <button
                      onClick={() => setConfirmCancel(true)}
                      className="-my-2 py-2 text-sm font-medium text-danger-ink underline-offset-2 hover:underline"
                    >
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
            className="ease-ui rounded-full p-2.5 text-ink-3 hover:bg-sunken hover:text-ink can-hover:p-2"
          >
            <ChevronDownIcon className={`ease-ui h-5 w-5 ${expanded ? "rotate-180" : ""}`} />
          </button>
          {next && active ? (
            <button
              onClick={() => onAdvance(order)}
              className="ease-ui inline-flex h-11 items-center gap-2 rounded-lg bg-ink pl-3.5 pr-3 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 active:scale-[0.97] can-hover:h-10"
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
