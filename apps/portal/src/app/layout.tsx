import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { BUSINESS } from "@sistema/shared";

import { MobileTabBar, Sidebar } from "@/components/Navigation";
import { AppProviders } from "@/components/providers/AppProviders";

import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--nf-sans" });

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
  themeColor: "#f4f4f5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={sans.variable}>
      <body>
        <AppProviders>
          <div className="flex h-dvh overflow-hidden">
            <Sidebar businessName={BUSINESS.name} />
            <main className="pb-tabbar min-w-0 flex-1 overflow-y-auto lg:pb-0">{children}</main>
          </div>
          <MobileTabBar />
        </AppProviders>
      </body>
    </html>
  );
}
