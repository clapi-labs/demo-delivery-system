"use client";

import { MotionConfig } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { InboxProvider } from "./InboxProvider";
import { LogisticsProvider } from "./LogisticsProvider";
import { MenuProvider } from "./MenuProvider";
import { OrdersProvider } from "./OrdersProvider";
import { ToastProvider } from "./ToastProvider";

/**
 * Todo el estado compartido del portal, en un solo componente de cliente para
 * que el layout siga siendo de servidor. `reducedMotion="user"` apaga las
 * animaciones de Motion si el sistema pide menos movimiento.
 *
 * **La pantalla del repartidor queda fuera.** No es el portal del restaurante:
 * la abre un domiciliario con su link, en su celular. Cargarle los providers
 * le bajaría al teléfono la lista completa de pedidos, los chats y el menú —
 * datos que no le corresponden— y un sondeo cada 5 segundos gastando sus
 * datos. Solo se le dejan los avisos.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const driver = usePathname()?.startsWith("/repartidor");

  if (driver) {
    return (
      <MotionConfig reducedMotion="user">
        <ToastProvider>{children}</ToastProvider>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <OrdersProvider>
          <InboxProvider>
            <MenuProvider>
              <LogisticsProvider>{children}</LogisticsProvider>
            </MenuProvider>
          </InboxProvider>
        </OrdersProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
