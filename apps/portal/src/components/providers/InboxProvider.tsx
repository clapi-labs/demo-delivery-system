"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { demoConversations } from "@/lib/demo-data";
import { needsAttention, type InboxConversation, type InboxMessage } from "@/lib/inbox";
import { markConversationRead, pauseBot, resumeBot, sendAgentMessage } from "@/lib/portal-api";

import { useToast } from "./ToastProvider";

/**
 * Las conversaciones, en el layout para que el contador de "te necesitan"
 * de la navegación y el Inicio estén siempre al día.
 *
 * TODO(backend): cargar de `GET /api/inbox` y sondear igual que los pedidos.
 * Las acciones ya pasan por `src/lib/portal-api.ts`.
 */

type InboxContext = {
  conversations: InboxConversation[];
  attentionCount: number;
  /** Pausar el bot y tomar la conversación. */
  intervene: (id: number) => void;
  /** Devolverle la conversación al bot. */
  resume: (id: number) => void;
  send: (id: number, text: string) => void;
  markRead: (id: number) => void;
};

const Context = createContext<InboxContext | null>(null);

export function useInbox() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useInbox fuera de InboxProvider");
  return ctx;
}

function systemMessage(text: string): InboxMessage {
  return {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: "agent",
    kind: "system",
    text,
    createdAt: new Date().toISOString(),
  };
}

export function InboxProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [conversations, setConversations] = useState<InboxConversation[]>(demoConversations);

  const update = useCallback((id: number, fn: (c: InboxConversation) => InboxConversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const intervene = useCallback(
    (id: number) => {
      let before: InboxConversation | undefined;
      update(id, (c) => {
        before = c;
        return {
          ...c,
          botPaused: true,
          escalationReason: null,
          messages: [...c.messages, systemMessage("Pausaste el bot. Ahora respondes tú.")],
        };
      });
      pauseBot(id).catch(() => {
        if (before) update(id, () => before!);
        toast({ message: "No se pudo pausar el bot", description: "Inténtalo de nuevo." });
      });
    },
    [update, toast],
  );

  const resume = useCallback(
    (id: number) => {
      let before: InboxConversation | undefined;
      update(id, (c) => {
        before = c;
        return {
          ...c,
          botPaused: false,
          escalationReason: null,
          messages: [...c.messages, systemMessage("El bot retomó la conversación.")],
        };
      });
      toast({ message: "El bot volvió a responder este chat" });
      resumeBot(id).catch(() => {
        if (before) update(id, () => before!);
        toast({ message: "No se pudo reactivar el bot", description: "Inténtalo de nuevo." });
      });
    },
    [update, toast],
  );

  const send = useCallback(
    (id: number, text: string) => {
      const tempId = `tmp-${Date.now()}`;
      const now = new Date().toISOString();
      update(id, (c) => ({
        ...c,
        // Responder toma la conversación: el bot no puede seguir hablando
        // encima de una persona (RF-33).
        botPaused: true,
        escalationReason: null,
        lastMessageAt: now,
        messages: [
          ...c.messages,
          { id: tempId, role: "agent", kind: "text", text, createdAt: now, pending: true },
        ],
      }));

      sendAgentMessage(id, text)
        .then((saved) =>
          update(id, (c) => ({
            ...c,
            messages: c.messages.map((m) => (m.id === tempId ? saved : m)),
          })),
        )
        .catch(() => {
          update(id, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== tempId) }));
          toast({
            message: "El mensaje no se envió",
            description: "Revisa la conexión o si la ventana de 24 h sigue abierta.",
          });
        });
    },
    [update, toast],
  );

  const markRead = useCallback(
    (id: number) => {
      update(id, (c) => (c.unread ? { ...c, unread: 0 } : c));
      markConversationRead(id).catch(() => {});
    },
    [update],
  );

  const value = useMemo(
    () => ({
      conversations,
      attentionCount: conversations.filter(needsAttention).length,
      intervene,
      resume,
      send,
      markRead,
    }),
    [conversations, intervene, resume, send, markRead],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
