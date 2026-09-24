"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { needsAttention, type InboxConversation, type InboxMessage } from "@/lib/inbox";
import { fetchConversations, markConversationRead, pauseBot, resumeBot, sendAgentMessage } from "@/lib/portal-api";

import { useToast } from "./ToastProvider";

/**
 * Las conversaciones, en el layout para que el contador de "te necesitan"
 * de la navegación y el Inicio estén siempre al día.
 *
 * Pausar, reactivar y responder ya persisten de verdad (`portal-api.ts`): el
 * patrón es el mismo que `OrdersProvider` — aplicar el cambio optimista,
 * mandarlo al servidor, y si sale bien recargar para quedar con el dato real
 * (incluye el mensaje de sistema que `pause`/`resume` graban en el hilo); si
 * falla, revertir.
 */

const POLL_MS = 5000;

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

export function InboxProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [conversations, setConversations] = useState<InboxConversation[]>([]);

  const load = useCallback(async () => {
    try {
      const fetched = await fetchConversations();
      setConversations(fetched);
    } catch {
      // Un fallo puntual no borra lo que ya está en pantalla.
    }
  }, []);

  useEffect(() => {
    // El mismo sondeo que `OrdersProvider`: cargar al montar y cada POLL_MS.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `load` es async; el setState real ocurre después del `await`, no de forma síncrona.
    load();
    const id = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const update = useCallback((id: number, fn: (c: InboxConversation) => InboxConversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const intervene = useCallback(
    (id: number) => {
      let before: InboxConversation | undefined;
      update(id, (c) => {
        before = c;
        return { ...c, botPaused: true, escalationReason: null };
      });
      pauseBot(id)
        .then(load)
        .catch(() => {
          if (before) update(id, () => before!);
          toast({ message: "No se pudo pausar el bot", description: "Inténtalo de nuevo." });
        });
    },
    [update, toast, load],
  );

  const resume = useCallback(
    (id: number) => {
      let before: InboxConversation | undefined;
      update(id, (c) => {
        before = c;
        return { ...c, botPaused: false, escalationReason: null };
      });
      toast({ message: "El bot volvió a responder este chat" });
      resumeBot(id)
        .then(load)
        .catch(() => {
          if (before) update(id, () => before!);
          toast({ message: "No se pudo reactivar el bot", description: "Inténtalo de nuevo." });
        });
    },
    [update, toast, load],
  );

  const send = useCallback(
    (id: number, text: string) => {
      const tempId = `tmp-${Date.now()}`;
      const now = new Date().toISOString();
      const pending: InboxMessage = { id: tempId, role: "agent", kind: "text", text, createdAt: now, pending: true };

      update(id, (c) => ({
        ...c,
        // Responder toma la conversación: el bot no puede seguir hablando
        // encima de una persona (RF-33).
        botPaused: true,
        escalationReason: null,
        lastMessageAt: now,
        messages: [...c.messages, pending],
      }));

      sendAgentMessage(id, text)
        .then((saved) => {
          update(id, (c) => ({
            ...c,
            messages: c.messages.map((m) => (m.id === tempId ? saved : m)),
          }));
          load();
        })
        .catch((err: unknown) => {
          update(id, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== tempId) }));
          toast({
            message: "El mensaje no se envió",
            description:
              err instanceof Error && err.message === "window_closed"
                ? "La ventana de 24 h de WhatsApp ya se cerró para este cliente."
                : "Revisa la conexión e inténtalo de nuevo.",
          });
        });
    },
    [update, toast, load],
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
