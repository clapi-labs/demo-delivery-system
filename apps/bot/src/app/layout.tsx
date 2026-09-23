import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Bot — WhatsApp" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
