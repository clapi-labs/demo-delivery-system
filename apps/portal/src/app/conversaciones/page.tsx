"use client";

import { useState } from "react";

import { formatPhone } from "@sistema/shared";

import { BOT_STATS, DEMO_CONVERSATIONS, relativeTime } from "@/lib/demo-data";

export default function ConversacionesPage() {
  const [selectedId, setSelectedId] = useState(DEMO_CONVERSATIONS[0]?.id ?? null);
  const selected = DEMO_CONVERSATIONS.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <h1 className="text-xl font-semibold">Conversaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">La bandeja del asistente de WhatsApp.</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Bot activo
          </span>
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            WhatsApp conectado
          </span>
          <span className="text-muted-foreground">
            Mensajes procesados hoy: <span className="font-medium text-foreground">{BOT_STATS.messagesToday}</span>
          </span>
          <span className="text-muted-foreground">
            Pedidos generados: <span className="font-medium text-foreground">{BOT_STATS.ordersGenerated}</span>
          </span>
          <span className="text-muted-foreground">
            Último mensaje: hace {BOT_STATS.lastMessageSecondsAgo} s
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-border">
          <ul className="divide-y divide-border">
            {DEMO_CONVERSATIONS.map((c) => {
              const last = c.messages[c.messages.length - 1];
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={`block w-full px-5 py-4 text-left transition-colors ${
                      selectedId === c.id ? "bg-muted" : "hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{c.customerName}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {relativeTime(last?.minutesAgo ?? 0)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{last?.text}</p>
                    {c.botPaused ? (
                      <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Escalado
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <header className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <p className="text-sm font-semibold">{selected.customerName}</p>
                  <p className="text-xs text-muted-foreground">{formatPhone(selected.phone)}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {selected.botPaused ? (
                    <p className="font-medium text-amber-700">
                      Pausado — {selected.escalationReason}
                    </p>
                  ) : (
                    <p className="font-medium text-emerald-700">Bot activo en este chat</p>
                  )}
                  <p className="mt-0.5">Ventana de 24 h: {Math.round(selected.windowMinutesLeft / 60)} h restantes</p>
                </div>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto px-6 py-6">
                {selected.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "customer" ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-md rounded-md px-4 py-2.5 text-sm ${
                        m.role === "customer"
                          ? "bg-muted text-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                        {m.role === "customer" ? "Cliente" : "Bot"}
                      </p>
                      <p>{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Selecciona una conversación.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
