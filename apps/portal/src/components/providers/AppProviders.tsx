"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { InboxProvider } from "./InboxProvider";
import { MenuProvider } from "./MenuProvider";
import { OrdersProvider } from "./OrdersProvider";
import { ToastProvider } from "./ToastProvider";

/**
 * Todo el estado compartido del portal, en un solo componente de cliente para
 * que el layout siga siendo de servidor. `reducedMotion="user"` apaga las
 * animaciones de Motion si el sistema pide menos movimiento.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <OrdersProvider>
          <InboxProvider>
            <MenuProvider>{children}</MenuProvider>
          </InboxProvider>
        </OrdersProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
