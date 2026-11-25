"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

function Bar() {
  const pathname = usePathname(), search = useSearchParams().toString();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Mulai saat tautan internal diklik; selesai ketika alamat berubah.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
      clearTimeout(timer.current); setState("loading");
      timer.current = setTimeout(() => setState("done"), 15000); // pengaman bila navigasi gagal
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  useEffect(() => {
    clearTimeout(timer.current);
    setState((s) => (s === "loading" ? "done" : s));
    const t = setTimeout(() => setState("idle"), 700);
    return () => clearTimeout(t);
  }, [pathname, search]);

  return <div className="nav-progress" data-state={state} aria-hidden="true" />;
}

export default function NavProgress() {
  return <Suspense fallback={null}><Bar /></Suspense>;
}
