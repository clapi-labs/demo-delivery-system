"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { needsAttention, type InboxConversation, type InboxMessage } from "@/lib/inbox";
import { fetchConversations, markConversationRead, pauseBot, resumeBot, sendAgentMessage } from "@/lib/portal-api";

import { useToast } from "./ToastProvider";

/**
 * Las conversaciones, en el layout para que el contador de "te necesitan"
 * de la navegación y el Inicio estén siempre al día.
 *
 * La lectura ya es real (`GET /api/inbox`, sondeada igual que los pedidos).
 * "Intervenir", "Devolver al bot" y "Responder" siguen sin persistir en Neon
 * (`TODO(backend)` en `portal-api.ts`), así que sus efectos se guardan en
 * `localPause`/`localExtras` y se reaplican encima de cada sondeo — si no,
 * el siguiente GET real los borraría a los 5 segundos.
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
  const [conversations, setConversations] = useState<InboxConversation[]>([]);

  const localPause = useRef(new Map<number, { botPaused: boolean; escalationReason: string | null }>());
  const localExtras = useRef(new Map<number, InboxMessage[]>());

  const applyLocal = useCallback((fetched: InboxConversation[]) => {
    return fetched.map((c) => {
      const pause = localPause.current.get(c.id);
      const extras = localExtras.current.get(c.id) ?? [];
      return {
        ...c,
        botPaused: pause ? pause.botPaused : c.botPaused,
        escalationReason: pause ? pause.escalationReason : c.escalationReason,
        messages: extras.length ? [...c.messages, ...extras] : c.messages,
      };
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const fetched = await fetchConversations();
      setConversations(applyLocal(fetched));
    } catch {
      // Un fallo puntual no borra lo que ya está en pantalla.
    }
  }, [applyLocal]);

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

  const addLocalMessage = useCallback((id: number, message: InboxMessage) => {
    localExtras.current.set(id, [...(localExtras.current.get(id) ?? []), message]);
  }, []);

  const dropLocalMessage = useCallback((id: number, messageId: string) => {
    const list = localExtras.current.get(id);
    if (!list) return;
    localExtras.current.set(id, list.filter((m) => m.id !== messageId));
  }, []);

  const replaceLocalMessage = useCallback((id: number, tempId: string, message: InboxMessage) => {
    const list = localExtras.current.get(id);
    if (!list) return;
    localExtras.current.set(id, list.map((m) => (m.id === tempId ? message : m)));
  }, []);

  const intervene = useCallback(
    (id: number) => {
      localPause.current.set(id, { botPaused: true, escalationReason: null });
      const sys = systemMessage("Pausaste el bot. Ahora respondes tú.");
      addLocalMessage(id, sys);
      update(id, (c) => ({
        ...c,
        botPaused: true,
        escalationReason: null,
        messages: [...c.messages, sys],
      }));
      pauseBot(id).catch(() => {
        toast({ message: "No se pudo pausar el bot", description: "Inténtalo de nuevo." });
      });
    },
    [update, toast, addLocalMessage],
  );

  const resume = useCallback(
    (id: number) => {
      localPause.current.set(id, { botPaused: false, escalationReason: null });
      const sys = systemMessage("El bot retomó la conversación.");
      addLocalMessage(id, sys);
      update(id, (c) => ({
        ...c,
        botPaused: false,
        escalationReason: null,
        messages: [...c.messages, sys],
      }));
      toast({ message: "El bot volvió a responder este chat" });
      resumeBot(id).catch(() => {
        toast({ message: "No se pudo reactivar el bot", description: "Inténtalo de nuevo." });
      });
    },
    [update, toast, addLocalMessage],
  );

  const send = useCallback(
    (id: number, text: string) => {
      const tempId = `tmp-${Date.now()}`;
      const now = new Date().toISOString();
      const pending: InboxMessage = { id: tempId, role: "agent", kind: "text", text, createdAt: now, pending: true };

      localPause.current.set(id, { botPaused: true, escalationReason: null });
      addLocalMessage(id, pending);
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
          replaceLocalMessage(id, tempId, saved);
          update(id, (c) => ({
            ...c,
            messages: c.messages.map((m) => (m.id === tempId ? saved : m)),
          }));
        })
        .catch(() => {
          dropLocalMessage(id, tempId);
          update(id, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== tempId) }));
          toast({
            message: "El mensaje no se envió",
            description: "Revisa la conexión o si la ventana de 24 h sigue abierta.",
          });
        });
    },
    [update, toast, addLocalMessage, replaceLocalMessage, dropLocalMessage],
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
