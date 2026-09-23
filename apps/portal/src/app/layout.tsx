import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";

import { BUSINESS } from "@sistema/shared";

import { MobileTabBar, Sidebar } from "@/components/Navigation";
import { InboxProvider } from "@/components/providers/InboxProvider";
import { MenuProvider } from "@/components/providers/MenuProvider";
import { OrdersProvider } from "@/components/providers/OrdersProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";

import "./globals.css";

// La misma familia que el menú público: el restaurante reconoce su marca en
// las dos pantallas. La condensada va en códigos, tiempos y cifras.
const sans = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--nf-sans" });
const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--nf-display",
});

export const metadata: Metadata = {
  title: `${BUSINESS.name} · Portal`,
  description: "Pedidos, conversaciones y menú del restaurante.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Ocupa también la zona de la muesca/barra del iPhone; los márgenes
  // seguros se respetan con `env(safe-area-inset-*)`.
  viewportFit: "cover",
  themeColor: "#f6f5f3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${sans.variable} ${display.variable}`}>
      <body>
        <ToastProvider>
          <OrdersProvider>
            <InboxProvider>
              <MenuProvider>
                <div className="flex h-dvh overflow-hidden">
                  <Sidebar businessName={BUSINESS.name} />
                  <main className="pb-tabbar min-w-0 flex-1 overflow-y-auto lg:pb-0">{children}</main>
                </div>
                <MobileTabBar />
              </MenuProvider>
            </InboxProvider>
          </OrdersProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
