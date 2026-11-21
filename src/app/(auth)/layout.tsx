import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { SITE_NAME } from "@/lib/labels";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="konten" className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-between"><Link href="/" className="text-[28px] font-extrabold leading-none tracking-tight" aria-label={`${SITE_NAME}, beranda`}>Arah<span className="text-brand">Saham</span><span className="font-semibold text-muted">.com</span></Link><ThemeToggle /></div>
      <div className="card">{children}</div>
      <p className="mt-6 text-center text-[13px] text-muted">Bukan nasihat investasi. Lihat <Link href="/disclaimer" className="underline">disclaimer</Link>.</p>
    </main>
  );
}
