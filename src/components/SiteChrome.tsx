import Link from "next/link";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { DesktopNav, MobileMenu } from "@/components/NavMenu";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import HeaderSearch from "@/components/HeaderSearch";
import { T } from "@/components/T";
import type { Key } from "@/lib/i18n";
export { default as MobileNav } from "@/components/MobileNav";
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
    <Link href="/" className={`inline-flex min-h-11 items-center font-extrabold leading-none tracking-tight text-foreground ${size === "lg" ? "text-[20px] min-[400px]:text-[24px] sm:text-[30px]" : "text-[24px]"}`} aria-label="ArahSaham.com, beranda">
      Arah<span className="text-brand">Saham</span><span className="font-semibold text-muted">.com</span>
    </Link>
  );
}

/** Tamu: "Daftar" satu-satunya tombol berwarna merek di header (Efek Von Restorff); "Masuk" sekunder. */
function GuestButtons() {
  return (
    <div className="flex items-center gap-2">
      <Link className="btn btn-ghost hidden sm:inline-flex" href="/masuk"><T k="auth.login" /></Link>
      <Link className="btn btn-primary max-sm:px-3 max-[379px]:hidden" href="/daftar"><T k="auth.signup" /></Link>
    </div>
  );
}

const FOOTER: { title: Key; links: { href: string; k?: Key; label?: string }[] }[] = [
  { title: "footer.product", links: [
    { href: "/pasar", k: "nav.market" }, { href: "/pasar/pergerakan", label: "Analisis pergerakan" }, { href: "/saham", k: "nav.stocks" },
    { href: "/free-float", label: "Free float" }, { href: "/peringkat", k: "footer.ranking" }, { href: "/indeks", k: "footer.indexChanges" },
  ] },
  { title: "footer.company", links: [{ href: "/blog", k: "nav.blog" }, { href: "/harga", k: "nav.pricing" }, { href: "/pengaturan", k: "nav.settings" }] },
  { title: "footer.legal", links: [{ href: "/syarat", k: "footer.terms" }, { href: "/privasi", k: "footer.privacy" }, { href: "/disclaimer", k: "footer.disclaimer" }] },
];

/** Bagian header setelah logo: menu utama, pencarian, dan akun. Satu kali baca akses untuk semuanya. */
function HeaderBar({ premium, signedIn, children }: { premium: boolean; signedIn: boolean; children: React.ReactNode }) {
  return (
    <>
      <DesktopNav premium={premium} />
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
        <HeaderSearch />
        {children}
        <MobileMenu premium={premium} signedIn={signedIn} />
      </div>
    </>
  );
}

async function AuthBar() {
  const a = await getAccess();
  return (
    <HeaderBar premium={a.isPremium} signedIn={!!a.userId}>
      {a.userId ? <UserMenu name={a.username} isAdmin={a.isAdmin} isPremium={a.isPremium} /> : <GuestButtons />}
    </HeaderBar>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/95 pt-[var(--safe-top)] backdrop-blur">
      <div className="container-x relative flex h-[var(--header-h)] items-center gap-2 sm:gap-4">
        <div className="me-2 shrink-0"><Logo /></div>
        <Suspense fallback={<HeaderBar premium={false} signedIn={false}><GuestButtons /></HeaderBar>}><AuthBar /></Suspense>
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
    <Link key={i.k + suffix} href={i.href} tabIndex={suffix === "b" ? -1 : undefined} aria-hidden={suffix === "b" ? true : undefined} className="flex items-center gap-2 whitespace-nowrap text-meta hover:underline">
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
    <footer className="mt-auto border-t border-line bg-surface pb-[calc(var(--bottom-nav-h)+var(--safe-bottom))] md:pb-0">
      <div className="container-x grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <div><Logo size="md" /><p className="mt-3 text-sm text-muted"><T k="footer.tagline" /></p></div>
        {FOOTER.map((g) => (
          <div key={g.title}>
            <h2 className="text-sm font-semibold"><T k={g.title} /></h2>
            <ul className="mt-2 text-sm text-muted">
              {/* Tinggi baris 40px: tautan mudah diketuk di ponsel (Hukum Fitts). */}
              {g.links.map((l) => <li key={l.href}><Link href={l.href} className="inline-flex min-h-10 items-center hover:text-foreground hover:underline">{l.k ? <T k={l.k} /> : l.label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line"><div className="container-x flex flex-wrap items-center justify-between gap-3 py-4"><p className="max-w-3xl text-meta text-muted">{DISCLAIMER} © <Suspense fallback="2026"><Year /></Suspense> ArahSaham.com.</p><ThemeToggle /></div></div>
    </footer>
  );
}
