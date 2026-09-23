import type { Metadata } from "next";
import { Barlow, Bebas_Neue } from "next/font/google";

import { BUSINESS } from "@sistema/shared";

import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--nf-display",
});
const barlow = Barlow({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--nf-sans",
});

export const metadata: Metadata = {
  title: `${BUSINESS.name} — Menú`,
  description: `Catálogo digital de ${BUSINESS.name}. Arma tu pedido y termínalo por WhatsApp.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${bebasNeue.variable} ${barlow.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
