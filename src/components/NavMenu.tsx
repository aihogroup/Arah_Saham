"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Lock, Menu, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { MENUS, PLAIN_LINKS, type NavMenuDef } from "@/lib/nav";

// Menu header desktop (Hukum Jakob: mega-menu seperti situs pasar modal lain). Item aktif diberi garis bawah merek.
const item = "relative inline-flex h-full items-center gap-1 px-3 text-body text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand";
const activeBar = "!text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-brand";
const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

function Panel({ m, premium, close }: { m: NavMenuDef; premium: boolean; close: () => void }) {
  return (
    <div id={`menu-${m.id}`} className="absolute inset-x-4 top-full z-50 pt-1 sm:inset-x-6">
      <div className="max-h-[calc(100dvh-110px)] overflow-auto overscroll-contain rounded-xl border border-line bg-background p-5 shadow-2">
        <div className={`grid gap-x-8 gap-y-4 ${m.sections.length >= 4 ? "grid-cols-4" : m.sections.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {m.sections.map((s) => (
            <div key={s.title}>
              <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-muted">{s.title}</p>
              <ul className="space-y-0.5">
                {s.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} onClick={close} className="block rounded-lg px-2.5 py-1.5 text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand">
                      <span className="inline-flex items-center gap-1.5">{l.label}{l.premium && !premium && <Lock size={12} aria-label="Premium" className="text-muted" />}</span>
                      {l.hint && <span className="block text-caption text-muted">{l.hint}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Menu utama desktop: panel mengambang saat diarahkan atau diklik; dapat dioperasikan dengan keyboard (Esc menutup). */
export function DesktopNav({ premium }: { premium: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const root = useRef<HTMLElement>(null);
  const path = usePathname();
  const clear = () => { if (timer.current) window.clearTimeout(timer.current); };
  const show = (id: string) => { clear(); setOpen(id); };
  const hide = () => { clear(); timer.current = window.setTimeout(() => setOpen(null), 140); };
  const close = useCallback(() => { clear(); setOpen(null); }, []);

  useEffect(() => { close(); }, [path, close]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) close(); };
    window.addEventListener("keydown", onKey); window.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onDown); };
  }, [close]);

  return (
    <nav ref={root} aria-label="Menu utama" className="hidden h-full items-stretch lg:flex">
      <ul className="flex items-stretch">
        {MENUS.map((m) => {
          const active = isActive(path, m.href) || m.sections.some((s) => s.links.some((l) => !l.href.includes("?") && !l.href.includes("#") && l.href !== "/" && isActive(path, l.href)));
          return (
            <li key={m.id} className="flex" onMouseEnter={() => show(m.id)} onMouseLeave={hide}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) hide(); }}>
              <button type="button" className={`${item} ${active ? activeBar : open === m.id ? "!text-foreground" : ""}`} aria-expanded={open === m.id} aria-controls={`menu-${m.id}`}
                onClick={() => show(m.id)} onFocus={() => show(m.id)}>
                {m.label}<ChevronDown size={14} aria-hidden="true" className={`transition-transform ${open === m.id ? "rotate-180" : ""}`} />
              </button>
              {open === m.id && <Panel m={m} premium={premium} close={close} />}
            </li>
          );
        })}
        {PLAIN_LINKS.map((l) => <li key={l.href} className="flex"><Link href={l.href} aria-current={isActive(path, l.href) ? "page" : undefined} className={`${item} ${isActive(path, l.href) ? activeBar : ""}`}>{l.label}</Link></li>)}
      </ul>
    </nav>
  );
}

/** Menu ponsel dan tablet: lembar layar penuh dengan akordeon. Dirender lewat portal karena header ber-backdrop-blur memotong elemen fixed. */
export function MobileMenu({ premium, signedIn }: { premium: boolean; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(64);
  const [mounted, setMounted] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  function toggle() {
    if (!open) setTop(Math.max(0, Math.round(btn.current?.closest("header")?.getBoundingClientRect().bottom ?? 64)));
    setOpen(!open);
  }
  const row = "flex min-h-[48px] items-center gap-1.5 text-body";

  return (
    <div className="lg:hidden">
      <button ref={btn} type="button" className="btn btn-ghost !min-w-[44px] px-2.5" aria-label={open ? "Tutup menu" : "Buka menu"} aria-expanded={open} aria-controls="menu-ponsel" onClick={toggle}>
        {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
      </button>
      {mounted && open && createPortal(
        <div id="menu-ponsel" role="dialog" aria-modal="true" aria-label="Menu" style={{ top }} className="fixed inset-x-0 bottom-0 z-50 overflow-y-auto overscroll-contain border-t border-line bg-background pb-[calc(6rem+var(--safe-bottom))]">
          <div className="container-x py-2">
            {MENUS.map((m) => (
              <details key={m.id} className="group border-b border-line">
                <summary className="flex min-h-[54px] cursor-pointer list-none items-center justify-between text-lg font-semibold">{m.label}<ChevronDown size={20} aria-hidden="true" className="transition-transform group-open:rotate-180" /></summary>
                <div className="space-y-4 pb-4">
                  {m.sections.map((s) => (
                    <div key={s.title}>
                      <p className="mb-1 text-caption font-semibold uppercase tracking-wide text-muted">{s.title}</p>
                      <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-x-4">
                        {s.links.map((l) => (
                          <li key={l.href + l.label}><Link href={l.href} aria-current={l.href === path ? "page" : undefined} className={`${row} ${l.href === path ? "font-semibold text-brand" : ""}`}>{l.label}{l.premium && !premium && <Lock size={12} aria-label="Premium" className="text-muted" />}</Link></li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            ))}
            {PLAIN_LINKS.map((l) => <Link key={l.href} href={l.href} className="flex min-h-[54px] items-center border-b border-line text-lg font-semibold">{l.label}</Link>)}
            <Link href="/pengaturan" className="flex min-h-[54px] items-center border-b border-line text-body">Pengaturan tampilan</Link>
            <div className="flex min-h-[54px] items-center justify-between text-body"><span>Mode terang atau gelap</span><ThemeToggle /></div>
            {!signedIn && <div className="grid grid-cols-2 gap-3 pt-2"><Link href="/masuk" className="btn">Masuk</Link><Link href="/daftar" className="btn btn-primary">Daftar</Link></div>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
