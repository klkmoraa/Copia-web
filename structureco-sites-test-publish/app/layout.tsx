import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "structureCo | Análisis estructural 2D",
  description: "Editor y analizador estructural 2D local-first con resultados trazables.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
