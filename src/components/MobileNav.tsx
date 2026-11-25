"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Landmark, Sparkles, UserRound } from "lucide-react";
import { T } from "@/components/T";
import type { Key as DictKey } from "@/lib/i18n";

// Navigasi bawah ponsel (Hukum Jakob: pola tab bawah yang sudah dikenal pengguna aplikasi seluler).
// Empat tujuan saja (Hukum Hick), target 64px setinggi jempol (Hukum Fitts), dan halaman aktif ditandai.
const ITEMS: { href: string; k: DictKey; Icon: typeof BarChart3; match: string[] }[] = [
  { href: "/pasar", k: "nav.market", Icon: BarChart3, match: ["/pasar", "/broker", "/indeks"] },
  { href: "/saham", k: "nav.stocks", Icon: Landmark, match: ["/saham", "/peringkat", "/free-float"] },
  { href: "/analisis", k: "nav.analysis", Icon: Sparkles, match: ["/analisis", "/beranda", "/riwayat", "/watchlist"] },
  { href: "/akun", k: "nav.account", Icon: UserRound, match: ["/akun", "/pengaturan", "/lengkapi-profil"] },
];

const isActive = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(p + "/"));

export default function MobileNav() {
  const path = usePathname() ?? "";
  return (
    <nav aria-label="Navigasi ponsel" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background/95 pb-[var(--safe-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ href, k, Icon, match }) => {
          const on = isActive(path, match);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined}
                className={`relative flex h-[var(--bottom-nav-h)] flex-col items-center justify-center gap-1 text-caption transition-colors active:bg-surface ${on ? "font-semibold text-brand" : "text-muted"}`}>
                {on && <span aria-hidden="true" className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-brand" />}
                <Icon size={22} strokeWidth={on ? 2.4 : 2} aria-hidden="true" /><T k={k} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
