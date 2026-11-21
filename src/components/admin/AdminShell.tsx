"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CreditCard, FileText, Gauge, History, Landmark, LayoutDashboard, ListTree, LogOut, Megaphone, Menu, Users, X, ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const GROUPS: { title: string; items: { href: string; label: string; icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }> }[] }[] = [
  { title: "Umum", items: [{ href: "/admin", label: "Ringkasan", icon: LayoutDashboard }, { href: "/admin/pengguna", label: "Pengguna", icon: Users }, { href: "/admin/pembayaran", label: "Pembayaran", icon: CreditCard }] },
  { title: "Data pasar", items: [{ href: "/admin/saham", label: "Saham", icon: Landmark }, { href: "/admin/indeks", label: "Indeks", icon: ListTree }, { href: "/admin/model", label: "Model & data", icon: Gauge }] },
  { title: "Konten", items: [{ href: "/admin/blog", label: "Blog", icon: FileText }, { href: "/admin/pengumuman", label: "Pengumuman", icon: Megaphone }] },
  { title: "Sistem", items: [{ href: "/admin/audit", label: "Audit", icon: History }] },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const active = (h: string) => (h === "/admin" ? path === "/admin" : path === h || path.startsWith(h + "/"));
  const current = GROUPS.flatMap((g) => g.items).find((i) => active(i.href))?.label ?? "Admin";

  const nav = (
    <nav aria-label="Menu admin" className="flex h-full flex-col">
      <div className="px-4 py-5">
        <Link href="/admin" className="text-[24px] font-extrabold leading-none tracking-tight" aria-label="ArahSaham.com, panel admin">Arah<span className="text-brand">Saham</span><span className="font-semibold text-muted">.com</span></Link>
        <p className="mt-1 text-[12px] text-muted">Panel admin</p>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const on = active(i.href); const Icon = i.icon;
                return (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={on ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors ${on ? "bg-brand font-medium text-brand-fg" : "hover:bg-surface"}`}>
                      <Icon size={18} aria-hidden />{i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-line p-3">
        <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] hover:bg-surface"><ArrowLeft size={18} aria-hidden />Kembali ke situs</Link>
        <form action="/auth/signout" method="post"><button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] hover:bg-surface"><LogOut size={18} aria-hidden />Keluar</button></form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-background lg:block">{nav}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-background/95 px-4 py-3 backdrop-blur">
          <button type="button" className="btn btn-ghost lg:hidden" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={20} aria-hidden /></button>
          <p className="text-[17px] font-semibold">{current}</p>
          <div className="ml-auto"><ThemeToggle /></div>
        </header>
        <main id="konten" className="mx-auto w-full max-w-[1200px] flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu admin">
          <button type="button" aria-label="Tutup menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative h-full w-72 max-w-[85vw] bg-background shadow-xl">
            <button type="button" className="btn btn-ghost absolute right-2 top-2" aria-label="Tutup menu" onClick={() => setOpen(false)}><X size={20} aria-hidden /></button>
            {nav}
          </div>
        </div>
      )}
    </div>
  );
}
