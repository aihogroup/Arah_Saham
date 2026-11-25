"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cached, rpcData } from "@/lib/client-cache";
import { symbolHref } from "@/lib/market";
import { createClient } from "@/lib/supabase/client";

type Hit = { kind: string; code: string; name: string; sub: string | null };
const KIND: Record<string, string> = { saham: "Saham", kurs: "Kurs", komoditas: "Komoditas", indeks: "Indeks", indeks_global: "Indeks global", etf_adr: "ETF/ADR" };

export const hrefOf = (h: Hit) =>
  h.kind === "saham" ? `/saham/${h.code}` : h.kind === "indeks" ? (h.code === "COMPOSITE" ? "/pasar" : `/saham/kelompok/indeks/${encodeURIComponent(h.code)}`) : symbolHref(h.code);

/** Pencarian saham, kurs, komoditas, dan indeks yang selalu ada di header. Tekan "/" untuk memfokuskan. */
export default function HeaderSearch() {
  const router = useRouter();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits([]); setBusy(false); return; }
    setBusy(true);
    let live = true;
    const id = window.setTimeout(() => {
      cached(`search:${term.toLowerCase()}`, () => rpcData<Hit[]>(createClient().rpc("search_all", { p_q: term, p_limit: 10 })), 5 * 60_000)
        .then((r) => { if (live) { setHits(r ?? []); setActive(0); setBusy(false); } })
        .catch(() => { if (live) { setHits([]); setBusy(false); } });
    }, 160);
    return () => { live = false; window.clearTimeout(id); };
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setMobile(true); setOpen(true); window.setTimeout(() => input.current?.focus(), 0); }
    };
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) { setOpen(false); setMobile(false); } };
    window.addEventListener("keydown", onKey); window.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onDown); };
  }, []);

  const go = useCallback((h: Hit) => { router.push(hrefOf(h)); setQ(""); setHits([]); setOpen(false); setMobile(false); input.current?.blur(); }, [router]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && hits[active]) { e.preventDefault(); go(hits[active]); }
    else if (e.key === "Escape") { setOpen(false); setMobile(false); input.current?.blur(); }
  }

  const showList = open && q.trim().length > 0;
  return (
    <div ref={wrap} className="contents">
      <button type="button" className="btn btn-ghost !min-w-[44px] px-2.5 md:hidden" aria-label="Cari saham, kurs, komoditas, atau indeks" onClick={() => { setMobile(true); setOpen(true); window.setTimeout(() => input.current?.focus(), 0); }}><Search size={24} aria-hidden="true" /></button>
      <div className={mobile ? "fixed inset-x-0 top-[64px] z-50 border-b border-line bg-background p-3 shadow-lg md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none" : "hidden min-w-0 flex-1 md:block md:max-w-[360px]"}>
        <div className="relative">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <input ref={input} type="search" role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
            className="input !h-10 w-full !ps-9 pe-9 text-sm" placeholder="Cari saham, kurs, indeks… ( / )" autoComplete="off" spellCheck={false}
            value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} />
          {q && <button type="button" className="absolute end-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-muted" aria-label="Hapus pencarian" onClick={() => { setQ(""); input.current?.focus(); }}><X size={16} aria-hidden="true" /></button>}
          {showList && (
            <ul id={listId} role="listbox" className="absolute start-0 end-0 top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-auto rounded-xl border border-line bg-background p-1 shadow-lg md:min-w-[360px]">
              {hits.length === 0 && <li className="px-3 py-3 text-sm text-muted" role="status">{busy ? "Mencari…" : "Tidak ada hasil."}</li>}
              {hits.map((h, i) => (
                <li key={h.kind + h.code} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                  className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 ${i === active ? "bg-surface" : ""}`}
                  onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => go(h)}>
                  <span className="min-w-0"><span className="font-semibold">{h.code.replace(/=X$|=F$/, "")}</span> <span className="text-meta text-muted">{h.name}</span></span>
                  <span className="chip !min-h-0 shrink-0 !px-2 !py-0 text-caption">{KIND[h.kind] ?? h.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
