"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Kind = "success" | "error" | "info";
type Action = { label: string; onClick: () => void };
type Item = { id: number; text: string; kind: Kind; action?: Action; leaving?: boolean };
type Detail = { text: string; kind: Kind; action?: Action };
const EVENT = "app-toast";
const LIFE: Record<Kind, number> = { success: 3200, info: 4000, error: 6000 };
const WITH_ACTION = 6000; // snackbar dengan aksi (mis. Urungkan) tampil lebih lama agar sempat diketuk
const OUT = 220;

/**
 * Tampilkan notifikasi singkat dari komponen klien mana saja.
 *   toast("Tersimpan")                                     → toast berhasil
 *   toast("Gagal menyimpan", "error")                      → toast galat (lebih lama)
 *   toast("Saham dihapus", "info", { label: "Urungkan", onClick: undo })  → snackbar dengan aksi
 */
export function toast(text: string, kind: Kind = "success", action?: Action) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { text, kind, action } }));
}

const ICON = { success: CheckCircle2, error: XCircle, info: Info } as const;
const ICON_CLASS: Record<Kind, string> = { success: "up", error: "down", info: "text-brand" };

/** Wilayah notifikasi (aria-live). Hilang otomatis, berhenti saat disorot/fokus, dan bisa ditutup manual. */
export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  const timers = useRef(new Map<number, number>());
  const paused = useRef(false);

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((p) => p.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
    window.setTimeout(() => setItems((p) => p.filter((i) => i.id !== id)), OUT);
  }, []);

  const schedule = useCallback((it: Item) => {
    window.clearTimeout(timers.current.get(it.id));
    timers.current.set(it.id, window.setTimeout(() => { if (!paused.current) dismiss(it.id); }, it.action ? WITH_ACTION : LIFE[it.kind]));
  }, [dismiss]);

  useEffect(() => {
    let n = 0;
    const map = timers.current;
    const on = (e: Event) => {
      const { text, kind, action } = (e as CustomEvent<Detail>).detail;
      const it: Item = { id: ++n, text, kind, action };
      setItems((p) => [...p.slice(-2), it]); // paling banyak 3 sekaligus (Hukum Miller)
      schedule(it);
    };
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener(EVENT, on); map.forEach((t) => window.clearTimeout(t)); map.clear(); };
  }, [schedule]);

  const pause = () => { paused.current = true; };
  const resume = () => { paused.current = false; items.forEach((i) => { if (!i.leaving) schedule(i); }); };

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false" onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume}>
      {items.map((i) => {
        const Icon = ICON[i.kind];
        return (
          <div key={i.id} className="toast" data-kind={i.kind} data-leaving={i.leaving ? "1" : undefined} role={i.kind === "error" ? "alert" : "status"}>
            <Icon size={18} aria-hidden="true" className={`shrink-0 ${ICON_CLASS[i.kind]}`} />
            <span className="min-w-0 flex-1">{i.text}</span>
            {i.action && <button type="button" className="toast-action" onClick={() => { i.action!.onClick(); dismiss(i.id); }}>{i.action.label}</button>}
            <button type="button" className="toast-close" aria-label="Tutup notifikasi" onClick={() => dismiss(i.id)}><X size={16} aria-hidden="true" /></button>
          </div>
        );
      })}
    </div>
  );
}
