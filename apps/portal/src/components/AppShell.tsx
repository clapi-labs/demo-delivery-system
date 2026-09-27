"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { MobileTabBar, Sidebar } from "./Navigation";

/**
 * El marco del portal: riel, contenido y barra inferior.
 *
 * **La pantalla del repartidor va sin marco.** No es el portal del
 * restaurante: la abre un domiciliario con su link para ver sus pedidos y
 * marcar entregas, y no tiene por qué ver —ni poder entrar a— el resto. Es
 * también lo que evita que la navegación intente leer los pedidos, que en esa
 * ruta no se cargan a propósito (ver `AppProviders`).
 */
export function AppShell({ businessName, children }: { businessName: string; children: ReactNode }) {
  const driver = usePathname()?.startsWith("/repartidor");

  if (driver) {
    return (
      <main className="h-dvh overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    );
  }

  return (
    <>
      <div className="flex h-dvh w-full overflow-hidden">
        <Sidebar businessName={businessName} />
        {/* `relative`: todo lo absoluto de las páginas se posiciona (y se recorta)
            dentro de <main>, no contra la ventana. */}
        <main className="pb-tabbar relative h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pt-[env(safe-area-inset-top)] md:pb-0">
          {children}
        </main>
      </div>
      <MobileTabBar />
    </>
  );
}
