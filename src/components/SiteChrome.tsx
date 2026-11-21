import Link from "next/link";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import ThemeToggle from "@/components/ThemeToggle";
import { BarChart3, Landmark, Menu, Settings, Sparkles, UserRound } from "lucide-react";
import { T } from "@/components/T";
import { getAccess } from "@/lib/auth";
import { getAnnouncements, getOverview } from "@/lib/data";
import { Banner, Delta } from "@/components/ui";
import { num } from "@/lib/format";
import { DISCLAIMER } from "@/lib/labels";
import { mprice, symbolHref } from "@/lib/market";

export const NAV = [
  { href: "/pasar", k: "nav.market" },
  { href: "/saham", k: "nav.stocks" },
  { href: "/blog", k: "nav.blog" },
  { href: "/harga", k: "nav.pricing" },
] as const;

async function Year() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

/** Wordmark teks "ArahSaham.com" (tanpa ikon). */
export function Logo({ size = "lg" }: { size?: "lg" | "md" }) {
  return (
    <Link href="/" className={`font-extrabold leading-none tracking-tight text-foreground ${size === "lg" ? "text-[26px] sm:text-[30px]" : "text-[24px]"}`} aria-label="ArahSaham.com, beranda">
      Arah<span className="text-brand">Saham</span><span className="font-semibold text-muted">.com</span>
    </Link>
  );
}

async function AuthNav() {
  const a = await getAccess();
  if (!a.userId) return <GuestButtons />;
  return (
    <div className="flex items-center gap-2">
      {a.isAdmin && <Link className="btn btn-ghost hidden sm:inline-flex" href="/admin"><T k="nav.admin" /></Link>}
      <Link className="btn btn-ghost hidden sm:inline-flex" href="/analisis"><T k="nav.myAnalysis" /></Link>
      <Link className="btn" href="/akun"><UserRound size={16} aria-hidden="true" /> {a.username ?? <T k="nav.account" />}</Link>
    </div>
  );
}

function GuestButtons() {
  return (
    <div className="flex items-center gap-2">
      <Link className="btn btn-ghost" href="/masuk"><T k="auth.login" /></Link>
      <Link className="btn btn-primary" href="/daftar"><T k="auth.signup" /></Link>
    </div>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/95 backdrop-blur">
      <div className="container-x flex h-[72px] items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Menu utama" className="hidden items-center gap-6 xl:flex">
            {NAV.map((n) => <Link key={n.href} href={n.href} className="text-[15px] text-muted hover:text-foreground"><T k={n.k} /></Link>)}
          </nav>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/pengaturan" className="btn btn-ghost px-3" aria-label="Pengaturan tampilan" title="Pengaturan tampilan"><Settings size={20} aria-hidden="true" /></Link>
          <ThemeToggle />
          <Suspense fallback={<GuestButtons />}><AuthNav /></Suspense>
          <details className="relative xl:hidden">
            <summary className="btn btn-ghost list-none px-3" aria-label="Buka menu"><Menu size={20} aria-hidden="true" /></summary>
            <div className="absolute right-0 top-12 w-56 rounded-xl border border-line bg-background p-2 shadow-lg">
              {NAV.map((n) => <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-3 hover:bg-surface"><T k={n.k} /></Link>)}
              <Link href="/pengaturan" className="block rounded-lg px-3 py-3 hover:bg-surface"><T k="nav.settings" /></Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export async function Ticker() {
  const o = await getOverview();
  if (!o?.ihsg) return null;
  // Seluruh data pasar (IHSG, komoditas, kurs, indeks global, proksi) bergulir perlahan; kecepatan sebanding jumlah item.
  const items = [
    { k: "IHSG", v: num(o.ihsg.close), c: o.ihsg.change_pct, href: "/pasar" },
    ...o.others.map((x) => ({ k: x.name, v: mprice(x.close), c: x.change_pct, href: symbolHref(x.symbol) })),
  ];
  const row = (suffix: string) => items.map((i) => (
    <Link key={i.k + suffix} href={i.href} tabIndex={suffix === "b" ? -1 : undefined} aria-hidden={suffix === "b" ? true : undefined} className="flex items-center gap-2 whitespace-nowrap text-[13px] hover:underline">
      <span className="text-muted">{i.k}</span><span className="font-medium">{i.v}</span><Delta value={i.c} />
    </Link>
  ));
  const seconds = Math.max(60, items.length * 6);
  return (
    <div className="ticker overflow-hidden border-b border-line bg-surface" aria-label="Pita pasar">
      <div className="container-x flex h-10 items-center gap-6 overflow-hidden">
        <div className="ticker-track" style={{ animationDuration: `${seconds}s` }} aria-live="off">{row("a")}{row("b")}</div>
      </div>
    </div>
  );
}

export async function AnnouncementBar() {
  const list = await getAnnouncements();
  return <>{list.map((a) => <Banner key={a.id} level={a.level as "info" | "warning" | "critical"}>{a.message}</Banner>)}</>;
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-surface pb-24 md:pb-0">
      <div className="container-x grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div><Logo size="md" /><p className="mt-3 text-[14px] text-muted"><T k="footer.tagline" /></p></div>
        <div><h3 className="text-[14px] font-semibold"><T k="footer.product" /></h3><ul className="mt-3 space-y-2 text-[14px] text-muted">
          <li><Link href="/pasar"><T k="nav.market" /></Link></li><li><Link href="/saham"><T k="nav.stocks" /></Link></li><li><Link href="/peringkat"><T k="footer.ranking" /></Link></li><li><Link href="/indeks"><T k="footer.indexChanges" /></Link></li></ul></div>
        <div><h3 className="text-[14px] font-semibold"><T k="footer.company" /></h3><ul className="mt-3 space-y-2 text-[14px] text-muted">
          <li><Link href="/blog"><T k="nav.blog" /></Link></li><li><Link href="/harga"><T k="nav.pricing" /></Link></li><li><Link href="/pengaturan"><T k="nav.settings" /></Link></li></ul></div>
        <div><h3 className="text-[14px] font-semibold"><T k="footer.legal" /></h3><ul className="mt-3 space-y-2 text-[14px] text-muted">
          <li><Link href="/syarat"><T k="footer.terms" /></Link></li><li><Link href="/privasi"><T k="footer.privacy" /></Link></li><li><Link href="/disclaimer"><T k="footer.disclaimer" /></Link></li></ul></div>
      </div>
      <div className="border-t border-line"><p className="container-x py-4 text-[13px] text-muted">{DISCLAIMER} © <Suspense fallback="2026"><Year /></Suspense> ArahSaham.com.</p></div>
    </footer>
  );
}

/** Navigasi bawah ponsel: Pasar, Saham, Analisis, Akun. */
export function MobileNav() {
  const items = [
    { href: "/pasar", k: "nav.market", Icon: BarChart3 },
    { href: "/saham", k: "nav.stocks", Icon: Landmark },
    { href: "/analisis", k: "nav.analysis", Icon: Sparkles },
    { href: "/akun", k: "nav.account", Icon: UserRound },
  ] as const;
  return (
    <nav aria-label="Navigasi ponsel" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-background md:hidden">
      {items.map(({ href, k, Icon }) => (
        <Link key={href} href={href} className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[12px] text-muted">
          <Icon size={20} aria-hidden="true" /><T k={k} />
        </Link>
      ))}
    </nav>
  );
}
