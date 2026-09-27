"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Courier, CourierPayment, NotifyResult, Settlement } from "@/lib/logistics";
import type { PortalOrder } from "@/lib/orders";
import * as api from "@/lib/portal-api";

import { useOrders } from "./OrdersProvider";
import { useToast } from "./ToastProvider";

/**
 * Quién reparte: la libreta y la asignación de cada pedido (RF-49 a RF-54).
 *
 * En el layout y no en la página de Domicilios porque la hoja de asignación se
 * abre desde una comanda, en Pedidos. Si la libreta viviera en su pantalla,
 * asignar obligaría a cargarla otra vez en cada tarjeta.
 *
 * La libreta cambia poco: se carga al entrar y al volver a la pestaña, sin el
 * sondeo de Pedidos. Las asignaciones sí viven en los pedidos, que ya se
 * refrescan solos cada 5 segundos.
 */

type LogisticsContext = {
  couriers: Courier[];
  loading: boolean;
  /** Falso si falta el secreto que firma los links del repartidor. */
  linksReady: boolean;
  reload: () => void;
  saveCourier: (courier: Omit<Courier, "driverUrl">) => Promise<Courier | null>;
  toggleCourier: (courierId: number) => void;
  deleteCourier: (courierId: number) => void;
  /**
   * Asignar o reasignar. Devuelve la ficha ya redactada (la del servidor, que
   * es la que lleva los datos reales del negocio) o `null` si no se pudo.
   */
  assign: (
    order: PortalOrder,
    courier: Courier,
    opts?: { paymentMode?: CourierPayment | null; vehicleCode?: string | null },
  ) => Promise<string | null>;
  setVehicle: (order: PortalOrder, vehicleCode: string) => Promise<void>;
  notify: (order: PortalOrder, courier: Courier) => Promise<NotifyResult>;
  /** La ficha de un pedido ya asignado, para reabrir la hoja sin reasignar. */
  ticketFor: (order: PortalOrder) => Promise<{ ticket: string; courierGone: boolean }>;
  settlement: () => Promise<Settlement[]>;
};

const Context = createContext<LogisticsContext | null>(null);

export function useLogistics() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useLogistics fuera de LogisticsProvider");
  return ctx;
}

export function LogisticsProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { refresh } = useOrders();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [linksReady, setLinksReady] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.fetchCouriers();
      setCouriers(data.couriers);
      setLinksReady(data.linksReady);
    } catch {
      // Un fallo puntual no borra la libreta que ya está en pantalla.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `load` es async; el setState ocurre después del `await`.
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const failed = useCallback(
    (what: string) => toast({ message: `No se pudo guardar: ${what}`, description: "Inténtalo de nuevo." }),
    [toast],
  );

  const saveCourier = useCallback(
    async (courier: Omit<Courier, "driverUrl">) => {
      try {
        const saved = await api.saveCourier(courier);
        setCouriers((prev) =>
          prev.some((c) => c.id === saved.id)
            ? prev.map((c) => (c.id === saved.id ? saved : c))
            : [...prev, saved],
        );
        toast({ message: courier.id ? "Cambios guardados" : `${saved.name} quedó registrado` });
        return saved;
      } catch {
        failed(courier.name);
        return null;
      }
    },
    [toast, failed],
  );

  const toggleCourier = useCallback(
    (courierId: number) => {
      const courier = couriers.find((c) => c.id === courierId);
      if (!courier) return;
      const active = !courier.active;
      setCouriers((prev) => prev.map((c) => (c.id === courierId ? { ...c, active } : c)));
      api.setCourierActive(courierId, active).catch(() => {
        setCouriers((prev) => prev.map((c) => (c.id === courierId ? courier : c)));
        failed(courier.name);
      });
    },
    [couriers, failed],
  );

  const deleteCourier = useCallback(
    (courierId: number) => {
      const courier = couriers.find((c) => c.id === courierId);
      if (!courier) return;
      setCouriers((prev) => prev.filter((c) => c.id !== courierId));
      // Sin "Deshacer" a propósito: borrar un repartidor no borra sus
      // entregas (el arqueo se conserva), así que volver a crearlo es
      // registrarlo de nuevo, no revertir nada.
      toast({ message: `${courier.name} se eliminó de la libreta` });
      api.deleteCourier(courierId).catch(() => {
        setCouriers((prev) => [...prev, courier]);
        failed(courier.name);
      });
    },
    [couriers, toast, failed],
  );

  const assign = useCallback(
    async (
      order: PortalOrder,
      courier: Courier,
      opts: { paymentMode?: CourierPayment | null; vehicleCode?: string | null } = {},
    ) => {
      try {
        const { ticket } = await api.assignDelivery(order.id, courier, opts);
        // El pedido se refresca para que la tarjeta muestre la asignación sin
        // esperar el próximo sondeo.
        refresh();
        return ticket;
      } catch {
        failed(`el repartidor de ${order.code}`);
        return null;
      }
    },
    [refresh, failed],
  );

  const setVehicle = useCallback(
    async (order: PortalOrder, vehicleCode: string) => {
      try {
        await api.setDeliveryVehicle(order.id, vehicleCode);
        refresh();
      } catch {
        failed(`la moto de ${order.code}`);
      }
    },
    [refresh, failed],
  );

  const notify = useCallback(
    async (order: PortalOrder, courier: Courier): Promise<NotifyResult> => {
      try {
        const { result } = await api.notifyCourier(order.id, courier);
        if (result.sent) refresh();
        return result;
      } catch {
        return { sent: false, reason: "failed" };
      }
    },
    [refresh],
  );

  const ticketFor = useCallback((order: PortalOrder) => api.fetchTicket(order.id), []);

  const settlement = useCallback(() => api.fetchSettlement(), []);

  const value = useMemo(
    () => ({
      couriers,
      loading,
      linksReady,
      reload: load,
      saveCourier,
      toggleCourier,
      deleteCourier,
      assign,
      setVehicle,
      notify,
      ticketFor,
      settlement,
    }),
    [
      couriers,
      loading,
      linksReady,
      load,
      saveCourier,
      toggleCourier,
      deleteCourier,
      assign,
      setVehicle,
      notify,
      ticketFor,
      settlement,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
