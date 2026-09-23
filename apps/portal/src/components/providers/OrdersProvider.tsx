"use client";

import { useRouter } from "next/navigation";
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

import { fetchOrders, updateOrderStatus } from "@/lib/portal-api";
import {
  ORDER_STATUS_LABEL,
  customerLabel,
  nextOrderStatus,
  type OrderStatus,
  type PortalOrder,
} from "@/lib/orders";

import { useToast } from "./ToastProvider";

/**
 * Los pedidos, vivos en todo el portal.
 *
 * Vive en el layout y no en la página de Pedidos porque un pedido nuevo tiene
 * que avisar esté donde esté el restaurante (en el chat, en el menú), y el
 * contador de la navegación tiene que estar siempre al día.
 */

/** Cada cuánto se refresca. Un pedido que entra aparece solo. */
const POLL_MS = 5000;

type OrdersContext = {
  orders: PortalOrder[];
  loading: boolean;
  error: boolean;
  /** Pedidos que acaban de llegar, para resaltarlos un momento. */
  freshIds: ReadonlySet<number>;
  /** Mover a cualquier estado. Con aviso y "Deshacer" salvo `silent`. */
  setStatus: (order: PortalOrder, status: OrderStatus, opts?: { silent?: boolean }) => void;
  /** Al siguiente paso del flujo: el gesto principal del tablero. */
  advance: (order: PortalOrder) => void;
};

const Context = createContext<OrdersContext | null>(null);

export function useOrders() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useOrders fuera de OrdersProvider");
  return ctx;
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const router = useRouter();
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [freshIds, setFreshIds] = useState<ReadonlySet<number>>(new Set());

  // Cambios hechos aquí que el servidor todavía no confirmó. Se aplican encima
  // de cada sondeo: sin esto, un sondeo que llega en medio devuelve la
  // tarjeta a su columna anterior por un instante.
  const overrides = useRef(new Map<number, OrderStatus>());
  // `null` hasta la primera carga: lo que ya estaba al abrir no es "nuevo".
  const knownIds = useRef<Set<number> | null>(null);

  const load = useCallback(async () => {
    try {
      const fetched = await fetchOrders();
      const merged = fetched.map((o) => {
        const status = overrides.current.get(o.id);
        return status ? { ...o, status } : o;
      });
      setOrders(merged);
      setError(false);

      const known = knownIds.current;
      const arrived = known ? merged.filter((o) => !known.has(o.id) && o.status === "pending") : [];
      knownIds.current = new Set(merged.map((o) => o.id));

      if (arrived.length > 0) {
        const first = arrived[0];
        toast({
          message: arrived.length === 1 ? `Pedido nuevo ${first.code}` : `${arrived.length} pedidos nuevos`,
          description: `${customerLabel(first)}, ${first.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}`,
          action: { label: "Ver", onClick: () => router.push("/pedidos") },
          duration: 8000,
        });
        setFreshIds(new Set(arrived.map((o) => o.id)));
        setTimeout(() => setFreshIds(new Set()), 12_000);
      }
    } catch {
      // Un fallo puntual no borra lo que ya está en pantalla: la cocina
      // prefiere datos de hace 5 segundos que un tablero vacío.
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [toast, router]);

  useEffect(() => {
    // Traer del servidor ES sincronizar con un sistema externo: justo para lo
    // que sirve un efecto.
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

  // Aplica el cambio (optimista) y lo manda al servidor; si falla, revierte.
  const applyStatus = useCallback(
    (order: PortalOrder, status: OrderStatus) => {
      const previous = order.status;
      overrides.current.set(order.id, status);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));

      updateOrderStatus(order.id, status)
        .then(() => {
          overrides.current.delete(order.id);
          load();
        })
        .catch(() => {
          overrides.current.delete(order.id);
          setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: previous } : o)));
          toast({
            message: `No se pudo cambiar el pedido ${order.code}`,
            description: "Revisa la conexión e inténtalo de nuevo.",
          });
        });
    },
    [toast, load],
  );

  const setStatus = useCallback(
    (order: PortalOrder, status: OrderStatus, opts?: { silent?: boolean }) => {
      const previous = order.status;
      if (previous === status) return;
      applyStatus(order, status);

      if (!opts?.silent) {
        toast({
          message: `${order.code} pasó a ${ORDER_STATUS_LABEL[status]}`,
          description: customerLabel(order),
          action: { label: "Deshacer", onClick: () => applyStatus({ ...order, status }, previous) },
        });
      }
    },
    [toast, applyStatus],
  );

  const advance = useCallback(
    (order: PortalOrder) => {
      const next = nextOrderStatus(order.status);
      if (next) setStatus(order, next);
    },
    [setStatus],
  );

  const value = useMemo(
    () => ({ orders, loading, error, freshIds, setStatus, advance }),
    [orders, loading, error, freshIds, setStatus, advance],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
