import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";

import { BUSINESS } from "@sistema/shared";

import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--nf-display",
});
const instrumentSans = Instrument_Sans({
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
    <html lang="es" className={`${bricolage.variable} ${instrumentSans.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
