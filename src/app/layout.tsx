import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { BOOT_SCRIPT } from "@/lib/prefs";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Arah Saham — Pahami arah pasar sebelum bursa dibuka", template: "%s · Arah Saham" },
  description: "Ringkasan kondisi pasar saham Indonesia dan analisis personal harian berbasis data. Alat bantu analisis, bukan rekomendasi investasi.",
  openGraph: { siteName: "Arah Saham", locale: "id_ID", type: "website" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2554d6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Terapkan tema tersimpan sebelum cat pertama agar tidak berkedip. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#konten" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:p-3">Lewati ke konten</a>
        {children}
      </body>
    </html>
  );
}
