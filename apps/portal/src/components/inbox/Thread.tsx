"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { formatCOP, formatPhone, formatWindowRemaining, windowRemaining } from "@sistema/shared";

import {
  BotIcon,
  ChevronLeftIcon,
  HandIcon,
  InfoIcon,
  PhoneIcon,
  SendIcon,
} from "@/components/icons";
import { useInbox } from "@/components/providers/InboxProvider";
import { useOrders } from "@/components/providers/OrdersProvider";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/ui";
import {
  PHASE_LABEL,
  QUICK_REPLIES,
  conversationName,
  initials,
  needsAttention,
  type InboxConversation,
  type InboxMessage,
} from "@/lib/inbox";
import { minutesBetween, relativeTime } from "@/lib/orders";
import { useMedia } from "@/lib/use-media";
import { useNow } from "@/lib/use-now";

const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });

function dayLabel(iso: string, now: number) {
  const date = new Date(iso);
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return dayFormat.format(date);
}

export function Avatar({ conversation, size = "md" }: { conversation: InboxConversation; size?: "md" | "lg" }) {
  const name = conversationName(conversation);
  const attention = needsAttention(conversation);
  const dims = size === "lg" ? "h-16 w-16 text-2xl" : "h-11 w-11 text-base";
  return (
    <span className="relative shrink-0">
      <span
        className={`flex items-center justify-center rounded-full font-semibold ${dims} ${
          attention ? "bg-warn text-zinc-950" : "bg-sunken text-ink-2 ring-1 ring-black/5"
        }`}
      >
        {initials(name)}
      </span>
      {/* Quién está respondiendo, visible desde la lista. */}
      <span
        title={conversation.botPaused ? "Responde una persona" : "Responde el bot"}
        className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface ${
          conversation.botPaused ? "bg-ink text-surface" : "bg-whatsapp text-white"
        }`}
      >
        {conversation.botPaused ? <HandIcon className="h-3 w-3" /> : <BotIcon className="h-3 w-3" />}
      </span>
    </span>
  );
}

export function ModeChip({ paused }: { paused: boolean }) {
  return paused ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-ink">
      <HandIcon className="h-3.5 w-3.5" />
      Respondes tú
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok-ink">
      <BotIcon className="h-3.5 w-3.5" />
      Responde el bot
    </span>
  );
}

function Bubble({ message, now }: { message: InboxMessage; now: number | null }) {
  if (message.kind === "system") {
    return (
      <p className="mx-auto w-fit rounded-full bg-sunken px-3 py-1 text-center text-xs text-ink-2">
        {message.text}
        {now ? <span className="ml-1.5 text-ink-3">{timeFormat.format(new Date(message.createdAt))}</span> : null}
      </p>
    );
  }

  const outgoing = message.role !== "customer";
  const styles =
    message.role === "customer"
      ? "bg-surface shadow-sm ring-1 ring-black/5 rounded-2xl rounded-bl-md"
      : message.role === "bot"
        ? "bg-whatsapp-soft ring-1 ring-whatsapp/15 rounded-2xl rounded-br-md"
        : "bg-zinc-900 text-zinc-50 shadow-sm rounded-2xl rounded-br-md";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: message.pending ? 0.6 : 1, y: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 36 }}
      className={`flex ${outgoing ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[85%] px-3.5 py-2 text-[15px] leading-snug sm:max-w-md ${styles}`}>
        {message.role === "bot" ? (
          <p className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-whatsapp-ink">
            <BotIcon className="h-3.5 w-3.5" />
            Bot
          </p>
        ) : message.role === "agent" ? (
          <p className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-rail-muted">
            <HandIcon className="h-3.5 w-3.5" />
            Tú
          </p>
        ) : null}

        <p className="whitespace-pre-wrap break-words">{message.text}</p>

        {message.meta?.buttons ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.meta.buttons.map((b) => (
              <span
                key={b}
                className="rounded-md border border-whatsapp/40 bg-surface px-2 py-1 text-xs font-medium text-whatsapp-ink"
              >
                {b}
              </span>
            ))}
          </div>
        ) : null}
        {message.meta?.cta ? (
          <span className="mt-2 block rounded-md border border-whatsapp/40 bg-surface px-2 py-1.5 text-center text-xs font-semibold text-whatsapp-ink">
            {message.meta.cta}
          </span>
        ) : null}

        <p
          className={`mt-1 text-right text-[11px] ${
            message.role === "agent" ? "text-rail-muted" : "text-ink-3"
          }`}
        >
          {message.kind === "button" ? <span className="mr-1.5">Tocó un botón</span> : null}
          {message.pending ? "Enviando…" : now ? timeFormat.format(new Date(message.createdAt)) : ""}
        </p>
      </div>
    </motion.div>
  );
}

/** Lo que hay que saber del cliente sin salir del chat. */
export function CustomerDetails({ conversation }: { conversation: InboxConversation }) {
  const { orders } = useOrders();
  const now = useNow();
  const theirOrders = orders.filter((o) => o.phone === conversation.phone);
  const lastInbound = conversation.lastInboundAt ? new Date(conversation.lastInboundAt) : null;
  const win = now ? windowRemaining(lastInbound, new Date(now)) : null;
  const fraction = win ? Math.min(1, win.minutesLeft / (24 * 60)) : 0;

  return (
    <div className="space-y-6 text-sm">
      <div className="flex flex-col items-center text-center">
        <Avatar conversation={conversation} size="lg" />
        <p className="mt-3 text-lg font-semibold tracking-title">{conversationName(conversation)}</p>
        <a
          href={`tel:+${conversation.phone}`}
          className="mt-1 inline-flex items-center gap-1.5 text-ink-2 tabular-nums hover:text-ink"
        >
          <PhoneIcon className="h-4 w-4" />
          {formatPhone(conversation.phone)}
        </a>
      </div>

      <dl className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-2">Quién responde</dt>
          <dd>
            <ModeChip paused={conversation.botPaused} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-2">En qué va</dt>
          <dd className="font-medium">{PHASE_LABEL[conversation.phase]}</dd>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-2">Ventana de WhatsApp</dt>
            <dd className={`font-medium ${win && !win.open ? "text-danger" : ""}`}>
              {win ? (win.open ? `Quedan ${formatWindowRemaining(win.minutesLeft)}` : "Cerrada") : "—"}
            </dd>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
            <div
              className={`h-full rounded-full ${fraction < 0.1 ? "bg-danger" : "bg-whatsapp"}`}
              style={{ width: `${fraction * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-3">
            WhatsApp solo deja escribirle al cliente hasta 24 h después de su último mensaje.
          </p>
        </div>
      </dl>

      <section>
        <h3 className="font-medium">Pedidos de este cliente</h3>
        {theirOrders.length === 0 ? (
          <p className="mt-2 text-ink-2">Todavía no ha hecho pedidos.</p>
        ) : (
          <ul className="card mt-2 divide-y divide-line overflow-hidden">
            {theirOrders.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link href={`/pedidos?pedido=${o.code}`} className="ease-ui flex items-center gap-3 px-3 py-2.5 hover:bg-sunken">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium">#{o.code}</p>
                    <p className="mt-1 text-xs text-ink-2">
                      {formatCOP(o.total)}
                      {now ? `, ${relativeTime(minutesBetween(o.createdAt, now)).toLowerCase()}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function Thread({ conversation, onBack }: { conversation: InboxConversation; onBack: () => void }) {
  const { intervene, resume, send } = useInbox();
  const now = useNow();
  const enterSends = useMedia("(pointer: fine)");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const draft = drafts[conversation.id] ?? "";
  const setDraft = (text: string) => setDrafts((d) => ({ ...d, [conversation.id]: text }));

  const lastInbound = conversation.lastInboundAt ? new Date(conversation.lastInboundAt) : null;
  const win = now ? windowRemaining(lastInbound, new Date(now)) : { open: true, minutesLeft: 0 };
  const attention = needsAttention(conversation);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation.id, conversation.messages.length]);

  // El cuadro crece con el texto hasta un tope, como en WhatsApp.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const takeOver = () => {
    intervene(conversation.id);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || !win.open) return;
    send(conversation.id, text);
    setDraft("");
  };

  // Separador de día solo cuando el día cambia respecto al mensaje anterior.
  const rows = conversation.messages.map((m, i) => {
    if (!now) return { m, day: "" };
    const day = dayLabel(m.createdAt, now);
    const prev = i > 0 ? dayLabel(conversation.messages[i - 1].createdAt, now) : "";
    return { m, day: day !== prev ? day : "" };
  });

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] md:px-5 md:py-3">
        <button
          onClick={onBack}
          aria-label="Volver a la lista"
          className="-ml-1 rounded-md p-1.5 text-ink-2 hover:bg-sunken md:hidden"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>
        <button onClick={() => setInfoOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left xl:pointer-events-none">
          <Avatar conversation={conversation} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{conversationName(conversation)}</span>
            <span className="block truncate text-xs text-ink-2 tabular-nums">{formatPhone(conversation.phone)}</span>
          </span>
        </button>

        <div className="hidden sm:block">
          <ModeChip paused={conversation.botPaused} />
        </div>

        {conversation.botPaused ? (
          <button
            onClick={() => resume(conversation.id)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-semibold transition-colors hover:border-ink-3"
          >
            <BotIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Devolver al bot</span>
            <span className="sm:hidden">Al bot</span>
          </button>
        ) : (
          <button
            onClick={takeOver}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-semibold text-surface transition-opacity hover:opacity-90"
          >
            <HandIcon className="h-4 w-4" />
            Intervenir
          </button>
        )}

        <button
          onClick={() => setInfoOpen(true)}
          aria-label="Datos del cliente"
          className="rounded-md p-2 text-ink-2 hover:bg-sunken xl:hidden"
        >
          <InfoIcon />
        </button>
      </header>

      {attention ? (
        <div className="flex items-center gap-3 border-b border-warn/25 bg-warn-soft px-4 py-2.5 text-sm md:px-5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-warn" />
          <p className="flex-1">
            <span className="font-semibold">El bot pidió ayuda.</span> {conversation.escalationReason}
          </p>
          <button onClick={takeOver} className="ease-ui shrink-0 rounded-lg bg-warn px-3 py-1.5 font-medium text-zinc-950 hover:brightness-95">
            Atender
          </button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {rows.map(({ m, day }) => {
            return (
              <div key={m.id} className="flex flex-col gap-2">
                {day ? (
                  <p className="my-2 text-center text-xs font-medium capitalize text-ink-3">{day}</p>
                ) : null}
                <Bubble message={m} now={now} />
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-line bg-surface px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:px-5">
        {!win.open ? (
          <p className="mx-auto max-w-3xl rounded-lg bg-sunken px-4 py-3 text-sm text-ink-2">
            <span className="font-semibold text-ink">No se le puede escribir a este cliente ahora.</span> Pasaron más
            de 24 h desde su último mensaje y WhatsApp no lo permite. Cuando vuelva a escribir, se reabre.
          </p>
        ) : !conversation.botPaused ? (
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <p className="flex-1 text-sm text-ink-2">
              El bot está respondiendo este chat. Para escribir tú, primero intervén: el bot se pausa solo aquí.
            </p>
            <button
              onClick={takeOver}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-surface hover:opacity-90"
            >
              <HandIcon className="h-4 w-4" />
              Intervenir
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-2.5 md:mx-0 md:px-0">
              {QUICK_REPLIES.map((reply) => (
                <button
                  key={reply}
                  onClick={() => {
                    setDraft(reply);
                    inputRef.current?.focus();
                  }}
                  className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
                >
                  {reply}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="relative flex items-end gap-2"
            >
              <label className="sr-only" htmlFor="composer">
                Mensaje para {conversationName(conversation)}
              </label>
              <textarea
                id="composer"
                ref={inputRef}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (enterSends && e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Escribe un mensaje"
                className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-canvas px-4 py-2.5 text-[15px] outline-none placeholder:text-ink-3 focus:border-ink-3"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Enviar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-whatsapp text-white transition-opacity disabled:opacity-40"
              >
                <SendIcon className="h-5 w-5" />
              </button>
            </form>
            <p className="mt-2 text-xs text-ink-3">
              {now && win.open ? `Ventana de WhatsApp abierta: quedan ${formatWindowRemaining(win.minutesLeft)}.` : ""}
              {enterSends ? " Enter envía, Shift + Enter hace un salto de línea." : ""}
            </p>
          </div>
        )}
      </div>

      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} title="Cliente">
        <CustomerDetails conversation={conversation} />
      </Sheet>
    </div>
  );
}
