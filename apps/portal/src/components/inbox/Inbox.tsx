"use client";

import { useEffect, useMemo, useState } from "react";

import { normalize } from "@sistema/shared";

import { ChatIcon } from "@/components/icons";
import { useInbox } from "@/components/providers/InboxProvider";
import { SearchField, Segmented } from "@/components/ui";
import { conversationName, needsAttention, type InboxConversation } from "@/lib/inbox";
import { elapsedLabel, minutesBetween } from "@/lib/orders";
import { useMedia } from "@/lib/use-media";
import { useNow } from "@/lib/use-now";

import { Avatar, CustomerDetails, Thread } from "./Thread";

type Filter = "all" | "attention" | "human";

function preview(c: InboxConversation) {
  const last = [...c.messages].reverse().find((m) => m.kind !== "system");
  if (!last) return "";
  const prefix = last.role === "bot" ? "Bot: " : last.role === "agent" ? "Tú: " : "";
  return prefix + last.text;
}

/**
 * La bandeja (RF-32 a RF-36).
 *
 * Lista a la izquierda, chat en el centro, datos del cliente a la derecha en
 * pantallas anchas. En el celular es navegación de dos niveles, como
 * WhatsApp: la lista, y al tocar un chat, el chat a pantalla completa.
 *
 * Abrir un chat NO pausa al bot — mirar no es tomar. Pausarlo es explícito:
 * el botón "Intervenir", o responder.
 */
export function Inbox({ initialPhone }: { initialPhone?: string }) {
  const { conversations, attentionCount, markRead } = useInbox();
  const now = useNow();
  const wide = useMedia("(min-width: 768px)");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(
    () => conversations.find((c) => c.phone === initialPhone)?.id ?? null,
  );

  const sorted = useMemo(() => {
    const q = normalize(query.trim());
    return conversations
      .filter((c) => filter === "all" || (filter === "attention" ? needsAttention(c) : c.botPaused))
      .filter((c) => !q || normalize(conversationName(c)).includes(q) || c.phone.includes(q))
      .sort((a, b) => {
        // Los que esperan a una persona van arriba, siempre.
        const pin = Number(needsAttention(b)) - Number(needsAttention(a));
        return pin || b.lastMessageAt.localeCompare(a.lastMessageAt);
      });
  }, [conversations, filter, query]);

  // En pantalla ancha siempre hay un chat abierto; en el celular, la lista
  // es la pantalla de inicio de la sección.
  const effectiveId = selectedId ?? (wide ? (sorted[0]?.id ?? null) : null);
  const selected = conversations.find((c) => c.id === effectiveId) ?? null;

  useEffect(() => {
    if (selected?.unread) markRead(selected.id);
  }, [selected?.id, selected?.unread, markRead]);

  const humanCount = conversations.filter((c) => c.botPaused).length;

  return (
    <div className="flex h-full">
      <aside
        className={`${selected ? "hidden md:flex" : "flex"} w-full flex-col border-line bg-surface md:w-80 md:shrink-0 md:border-r lg:w-96`}
      >
        <div className="space-y-3 px-4 pb-3 pt-5 lg:pt-8">
          <div>
            <h1 className="font-display text-[2rem] font-semibold leading-none tracking-tight">Conversaciones</h1>
            <p className="mt-1.5 text-sm text-ink-2">
              {attentionCount > 0
                ? `${attentionCount} ${attentionCount === 1 ? "cliente espera" : "clientes esperan"} a una persona.`
                : "El bot está atendiendo. Nadie te espera."}
            </p>
          </div>
          <SearchField value={query} onChange={setQuery} placeholder="Buscar por nombre o teléfono" />
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Todas" },
              { value: "attention", label: "Te necesitan", count: attentionCount },
              { value: "human", label: "Tú", count: humanCount },
            ]}
          />
        </div>

        <ul className="flex-1 divide-y divide-line overflow-y-auto border-t border-line">
          {sorted.length === 0 ? (
            <li className="px-6 py-12 text-center text-sm text-ink-2">
              {filter === "attention" ? "Ningún cliente está esperando a una persona." : "No hay conversaciones que coincidan."}
            </li>
          ) : (
            sorted.map((c) => {
              const active = c.id === selected?.id;
              const attention = needsAttention(c);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${
                      active ? "bg-sunken" : "hover:bg-sunken/60"
                    }`}
                  >
                    <Avatar conversation={c} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate ${c.unread || attention ? "font-semibold" : "font-medium"}`}>
                          {conversationName(c)}
                        </span>
                        <span className={`shrink-0 text-xs ${c.unread ? "font-semibold text-whatsapp-ink" : "text-ink-3"}`}>
                          {now ? elapsedLabel(minutesBetween(c.lastMessageAt, now)) : ""}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className={`line-clamp-1 flex-1 text-sm ${c.unread ? "text-ink" : "text-ink-2"}`}>
                          {preview(c)}
                        </span>
                        {c.unread ? (
                          <span className="min-w-5 shrink-0 rounded-full bg-whatsapp px-1.5 text-center text-xs font-bold leading-5 text-white">
                            {c.unread}
                          </span>
                        ) : null}
                      </span>
                      {attention ? (
                        <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink">
                          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                          Te necesita
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      {selected ? (
        <>
          {/* En el celular el chat tapa la barra inferior: el cuadro de
              escribir queda abajo, donde está el pulgar. */}
          <div className="fixed inset-0 z-40 flex md:static md:z-auto md:min-w-0 md:flex-1">
            <Thread conversation={selected} onBack={() => setSelectedId(null)} />
          </div>
          <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-line bg-surface px-5 py-8 xl:block">
            <CustomerDetails conversation={selected} />
          </aside>
        </>
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center gap-2 text-ink-2 md:flex">
          <ChatIcon className="h-8 w-8 text-ink-3" />
          <p>Elige una conversación.</p>
        </div>
      )}
    </div>
  );
}
