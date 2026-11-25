import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { Poppins, Source_Serif_4 } from "next/font/google";
import Toaster from "@/components/Toaster";
import NavProgress from "@/components/NavProgress";
import OfflineBar from "@/components/OfflineBar";
import ConfirmHost from "@/components/ConfirmDialog";
import { BOOT_SCRIPT } from "@/lib/prefs";
import "./globals.css";

// Font: hanya ketebalan yang dipakai, subset latin, swap agar teks langsung tampil.
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"], display: "swap", preload: false });
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Arah Saham — Pahami arah pasar sebelum bursa dibuka", template: "%s · Arah Saham" },
  description: "Ringkasan kondisi pasar saham Indonesia dan analisis personal harian berbasis data. Alat bantu analisis, bukan rekomendasi investasi.",
  applicationName: "Arah Saham",
  openGraph: { siteName: "Arah Saham", locale: "id_ID", type: "website" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: "Arah Saham", statusBarStyle: "default" },
};

// viewport-fit=cover: konten boleh memakai seluruh layar; area aman diatur lewat env(safe-area-inset-*) di token.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" dir="ltr" data-theme="light" className={`${poppins.variable} ${serif.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Terapkan tema tersimpan sebelum cat pertama agar tidak berkedip. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* Layar pembuka: hanya tampil saat dibuka sebagai aplikasi terpasang (lihat .splash di styles/motion.css). */}
        <div className="splash" aria-hidden="true">
          <Image src="/logo-mark.png" alt="" width={210} height={160} priority className="h-24 w-auto" />
          <p className="text-3xl font-extrabold leading-none tracking-tight">Arah<span className="text-brand">Saham</span><span className="font-semibold text-muted">.com</span></p>
        </div>
        <a href="#konten" className="skip-link">Lewati ke konten</a>
        <NavProgress />
        <OfflineBar />
        {children}
        <Toaster />
        <ConfirmHost />
      </body>
    </html>
  );
}
