"use client";

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
  onAdvance: (order: PortalOrder) => void;
  onSetStatus: (order: PortalOrder, status: OrderStatus) => void;
};

/** Qué fracción del ancho hay que deslizar para que cuente. */
const SWIPE_THRESHOLD = 0.35;

/**
 * La comanda: un pedido tal como lo necesita la cocina.
 *
 * Tres formas de avanzarlo, todas a un solo gesto: el botón (siempre), deslizar
 * a la derecha con el dedo (celular) y arrastrarlo a la siguiente columna
 * (escritorio). Tocar la tarjeta despliega el detalle ahí mismo, sin abrir
 * otra pantalla.
 */
export function OrderTicket({ order, now, fresh, onAdvance, onSetStatus }: Props) {
  const [expanded, setExpanded] = useState(false);
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
    <div className={`relative ${fresh ? "animate-arrive" : ""}`}>
      {/* Lo que aparece detrás al deslizar: a dónde va el pedido. */}
      {next && nextTone && active ? (
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center gap-2 rounded-lg px-5 font-semibold transition-colors ${
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
          transition: swiping && !leaving ? "none" : "transform 180ms ease-out",
          touchAction: "pan-y",
        }}
        className={`relative overflow-hidden rounded-lg border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)] ${
          fresh ? "border-st-new ring-2 ring-st-new/25" : "border-line"
        } ${canDrag && active ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <span className={`absolute inset-y-0 left-0 w-1 ${tone.dot}`} aria-hidden="true" />

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
              <p className="font-display text-2xl font-semibold leading-none tracking-wide">{order.code}</p>
              <p className="mt-1.5 truncate font-medium">{customerLabel(order)}</p>
            </div>
            {active ? (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-display text-base font-semibold leading-none tabular-nums ${
                  level === "late"
                    ? "bg-danger-soft text-danger"
                    : level === "warn"
                      ? "bg-st-prep-soft text-st-prep-ink"
                      : "bg-sunken text-ink-2"
                }`}
                title="Tiempo desde que entró el pedido"
              >
                <ClockIcon className="h-4 w-4" />
                {minutes === null ? "—" : elapsedLabel(minutes)}
              </span>
            ) : (
              <StatusBadge status={order.status} />
            )}
          </div>

          <ul className="mt-3 space-y-1.5 border-t border-dashed border-line pt-3">
            {order.items.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-snug">
                <span className="w-5 shrink-0 text-right font-display text-lg font-bold leading-5 tabular-nums">
                  {item.quantity}
                </span>
                <span className="min-w-0">
                  {item.name}
                  {item.options.length > 0 ? (
                    <span className="block text-sm text-ink-2">{item.options.map((o) => o.name).join(", ")}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          {order.address && !expanded ? (
            <p className="mt-3 flex items-center gap-1.5 truncate text-sm text-ink-2">
              <PinIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{order.address}</span>
            </p>
          ) : null}
        </div>

        {expanded ? (
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
                    className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-whatsapp-ink hover:bg-whatsapp-soft"
                  >
                    <ChatIcon className="h-4 w-4" />
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
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        current
                          ? `border-transparent ${STATUS_TONE[s].soft} ${STATUS_TONE[s].ink}`
                          : "border-line bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
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
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-danger-soft px-3 py-2">
                  <p className="flex-1 font-medium text-danger">¿Cancelar el pedido {order.code}?</p>
                  <button
                    onClick={() => setConfirmCancel(false)}
                    className="rounded-md px-2.5 py-1.5 font-medium text-ink-2 hover:bg-surface"
                  >
                    No
                  </button>
                  <button
                    onClick={() => onSetStatus(order, "cancelled")}
                    className="rounded-md bg-danger px-3 py-1.5 font-semibold text-white"
                  >
                    Sí, cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="text-sm font-medium text-danger underline-offset-2 hover:underline"
                >
                  Cancelar pedido
                </button>
              )
            ) : null}
          </div>
        ) : null}

        <footer className="flex items-center gap-3 border-t border-line py-2.5 pl-5 pr-2.5">
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-semibold leading-none tabular-nums">{formatCOP(order.total)}</p>
            <p className={`mt-1 truncate text-xs ${order.paymentMethod ? "text-ink-2" : "font-medium text-st-prep-ink"}`}>
              {paymentLabel(order.paymentMethod)}
            </p>
          </div>
          <button
            onClick={toggle}
            aria-label={expanded ? "Ocultar detalle" : "Ver detalle"}
            className="rounded-md p-2 text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
          >
            <ChevronDownIcon className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          {next && active ? (
            <button
              onClick={() => onAdvance(order)}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink pl-4 pr-3 text-sm font-semibold text-surface transition-opacity hover:opacity-90 active:scale-[0.98]"
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
