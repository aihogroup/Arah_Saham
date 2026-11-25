"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { haptic } from "@/lib/haptics";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;   // label berorientasi tindakan, mis. "Hapus catatan"
  cancelLabel?: string;
  tone?: "danger" | "default";
};
type Request = ConfirmOptions & { resolve: (ok: boolean) => void };
const EVENT = "app-confirm";

/**
 * Minta konfirmasi sebelum tindakan penting atau tidak bisa dibatalkan.
 *   if (!(await confirmDialog({ title: "Hapus catatan?", tone: "danger", confirmLabel: "Hapus" }))) return;
 * Ditampilkan oleh <ConfirmHost /> di layout akar. Tanpa host (mis. JS gagal dimuat), kembali ke window.confirm.
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const handled = !window.dispatchEvent(new CustomEvent<Request>(EVENT, { detail: { ...opts, resolve }, cancelable: true }));
    if (!handled) resolve(window.confirm(opts.message ? `${opts.title}\n\n${opts.message}` : opts.title));
  });
}

/**
 * Host dialog memakai <dialog> bawaan: fokus terkunci di dalam, Esc menutup, latar belakang inert.
 * Di ponsel tampil sebagai lembar bawah (bottom sheet) agar tombol berada di zona jempol.
 * Tombol aman ("Batal") mendapat fokus awal untuk mencegah penghapusan tak sengaja.
 */
export default function ConfirmHost() {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [req, setReq] = useState<Request | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault(); // tanda bahwa host menangani permintaan
      const d = (e as CustomEvent<Request>).detail;
      setReq((prev) => { prev?.resolve(false); return d; });
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!req || !el) return;
    if (!el.open) el.showModal();
    if (req.tone === "danger") haptic("warning");
    cancelRef.current?.focus();
  }, [req]);

  function close(ok: boolean) {
    if (!req) return;
    if (ok) haptic(req.tone === "danger" ? "tap" : "success");
    req.resolve(ok);
    ref.current?.close();
    setReq(null);
  }

  const danger = req?.tone === "danger";
  const Icon = danger ? AlertTriangle : HelpCircle;
  return (
    <dialog ref={ref} className="sheet" aria-labelledby="confirm-title" aria-describedby={req?.message ? "confirm-msg" : undefined}
      onCancel={(e) => { e.preventDefault(); close(false); }}
      onClick={(e) => { if (e.target === ref.current) close(false); }}>
      {req && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-full ${danger ? "bg-[var(--warn-bg)] text-down" : "bg-brand-soft text-brand"}`} aria-hidden="true"><Icon size={20} /></span>
            <div className="min-w-0">
              <h2 id="confirm-title" className="text-lg">{req.title}</h2>
              {req.message && <p id="confirm-msg" className="mt-1 text-sm text-muted">{req.message}</p>}
            </div>
          </div>
          {/* Ponsel: "Batal" paling bawah, titik termudah dijangkau jempol, agar ketukan tak sengaja tidak menghapus
              (pola lembar aksi iOS/Android). Desktop: berdampingan, tombol tindakan di kanan. */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button ref={cancelRef} type="button" className="btn" onClick={() => close(false)}>{req.cancelLabel ?? "Batal"}</button>
            <button type="button" className={`btn ${danger ? "btn-danger-solid" : "btn-primary"}`} onClick={() => close(true)}>{req.confirmLabel ?? "Lanjutkan"}</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
