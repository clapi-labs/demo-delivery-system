import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { BUSINESS } from "@sistema/shared";

import { Sidebar } from "@/components/Sidebar";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--nf-sans" });

export const metadata: Metadata = {
  title: `${BUSINESS.name} — Portal`,
  description: "Pedidos, conversaciones y catálogo del restaurante.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar businessName={BUSINESS.name} />
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
