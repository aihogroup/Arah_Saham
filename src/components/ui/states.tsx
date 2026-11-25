// Molekul keadaan: kosong, galat, berhasil, terkunci, pengumuman.
// Setiap keadaan menjelaskan apa yang terjadi DAN apa yang bisa dilakukan pengguna berikutnya.
import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Inbox, Lock, RotateCcw } from "lucide-react";

/** Keadaan kosong: pesan singkat + satu tindakan yang membantu. */
export function Empty({ message, title, action, icon }: { message: ReactNode; title?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-8 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface text-muted" aria-hidden="true">{icon ?? <Inbox size={22} />}</span>
      {title && <p className="font-semibold">{title}</p>}
      <p className="measure text-muted">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Keadaan galat: bahasa awam (tanpa istilah teknis) + tombol coba lagi tanpa mengulang seluruh alur. */
export function ErrorState({ title = "Terjadi kendala", message = "Data belum bisa dimuat. Periksa koneksi Anda lalu coba lagi.", onRetry, retryHref, retryLabel = "Coba lagi" }:
  { title?: string; message?: ReactNode; onRetry?: () => void; retryHref?: string; retryLabel?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-[var(--warn-bg)] text-[var(--warn-fg)]" aria-hidden="true"><AlertTriangle size={26} /></span>
      <h1 className="text-2xl">{title}</h1>
      <p className="measure text-muted">{message}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}><RotateCcw size={16} aria-hidden="true" />{retryLabel}</button>}
        {retryHref && <Link className="btn btn-primary" href={retryHref}><RotateCcw size={16} aria-hidden="true" />{retryLabel}</Link>}
        <Link className="btn" href="/">Ke beranda</Link>
      </div>
    </div>
  );
}

/** Keadaan berhasil di akhir alur (Aturan Puncak-Akhir): penutup yang jelas dan langkah berikutnya. */
export function SuccessState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-up" aria-hidden="true"><CheckCircle2 size={28} /></span>
      <h1 className="text-2xl">{title}</h1>
      {children && <div className="measure text-muted">{children}</div>}
      {action && <div className="mt-2 w-full">{action}</div>}
    </div>
  );
}

/** Baris/kartu terkunci: satu kalimat penjelas + satu tindakan. */
export function Locked({ text, href = "/harga", cta = "Lihat paket" }: { text: string; href?: string; cta?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-body text-muted"><Lock size={16} aria-hidden="true" /> {text}</p>
      <Link className="btn btn-primary" href={href}>{cta}</Link>
    </div>
  );
}

/** Pengumuman sebaris di atas header. */
export function Banner({ level, children }: { level: "info" | "warning" | "critical"; children: ReactNode }) {
  const cls = level === "info" ? "bg-brand-soft" : "bg-[var(--warn-bg)] text-[var(--warn-fg)]";
  return <div role={level === "critical" ? "alert" : "status"} className={`${cls} px-4 py-2 text-center text-sm`}>{children}</div>;
}
