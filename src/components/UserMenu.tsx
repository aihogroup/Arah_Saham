"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Menu akun: tempat pengaturan, tema, dan keluar, agar tidak memenuhi header.
 * Papan ketik: Enter/Spasi membuka dan memfokuskan item pertama, panah atas/bawah berpindah item,
 * Home/End ke ujung, Esc menutup dan mengembalikan fokus ke tombol.
 */
export default function UserMenu({ name, isAdmin, isPremium }: { name: string | null; isAdmin: boolean; isPremium: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const close = (refocus = false) => { setOpen(false); if (refocus) btn.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(true); };
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    window.addEventListener("keydown", onKey); window.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onDown); };
  }, [open]);

  function onMenuKey(e: React.KeyboardEvent) {
    const list = items(); if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => { e.preventDefault(); list[(n + list.length) % list.length].focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
    else if (e.key === "Tab") close();
  }

  const row = "flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm hover:bg-surface focus-visible:bg-surface";
  return (
    <div ref={ref} className="relative">
      <button ref={btn} type="button" className="btn max-sm:px-3" aria-haspopup="menu" aria-expanded={open} aria-controls="menu-akun" onClick={() => setOpen(!open)}
        aria-label={`Menu akun${name ? ` ${name}` : ""}`}>
        <UserRound size={16} aria-hidden="true" /><span className="hidden max-w-[120px] truncate sm:inline">{name ?? "Akun"}</span>
        <ChevronDown size={14} aria-hidden="true" className={`hidden transition-transform sm:block ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div ref={menu} id="menu-akun" role="menu" aria-label="Menu akun" onKeyDown={onMenuKey}
          className="absolute end-0 top-[calc(100%+6px)] z-50 w-64 rounded-xl border border-line bg-background p-1.5 shadow-2" onClick={() => close()}>
          {isPremium && <Link role="menuitem" href="/beranda" className={row}><Sparkles size={18} aria-hidden="true" />Beranda Premium</Link>}
          <Link role="menuitem" href="/akun" className={row}><UserRound size={18} aria-hidden="true" />Akun dan profil risiko</Link>
          <Link role="menuitem" href="/pengaturan" className={row}><Settings size={18} aria-hidden="true" />Pengaturan tampilan</Link>
          {isAdmin && <Link role="menuitem" href="/admin" className={row}><ShieldCheck size={18} aria-hidden="true" />Admin</Link>}
          <div role="none" className="flex min-h-[44px] items-center justify-between px-3 text-sm" onClick={(e) => e.stopPropagation()}><span className="text-muted">Mode terang atau gelap</span><ThemeToggle /></div>
          <div role="separator" className="my-1 h-px bg-line" />
          <form action="/auth/signout" method="post" role="none"><button role="menuitem" className={`${row} w-full text-start`}><LogOut size={18} aria-hidden="true" />Keluar</button></form>
        </div>
      )}
    </div>
  );
}
