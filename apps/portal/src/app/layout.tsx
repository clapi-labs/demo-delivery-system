import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { BUSINESS } from "@sistema/shared";

import { AppShell } from "@/components/AppShell";
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
      <body className="h-dvh overflow-hidden">
        <AppProviders>
          <AppShell businessName={BUSINESS.name}>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
