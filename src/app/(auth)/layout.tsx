import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Logo } from "@/components/SiteChrome";

// Halaman masuk/daftar: satu kolom sempit tanpa navigasi lain agar perhatian tertuju pada formulir (Hukum Hick).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="konten" className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-4 py-6 pb-[calc(var(--space-6)+var(--safe-bottom))] sm:py-8">
      <div className="mb-6 flex items-center justify-between"><Logo size="md" /><ThemeToggle /></div>
      <div className="card">{children}</div>
      <p className="mt-6 text-center text-meta text-muted">Bukan nasihat investasi. Lihat <Link href="/disclaimer" className="underline">disclaimer</Link>.</p>
    </main>
  );
}
