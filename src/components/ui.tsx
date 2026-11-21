import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Lock, Minus } from "lucide-react";
import { dateId, dir, pct } from "@/lib/format";
import { DISCLAIMER } from "@/lib/labels";

/** Perubahan harga: selalu panah + tanda +/− (tidak hanya warna). */
export function Delta({ value, digits = 2, className = "" }: { value: number | string | null | undefined; digits?: number; className?: string }) {
  const d = dir(value);
  const Icon = d === "up" ? ArrowUpRight : d === "down" ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${d} ${className}`}>
      <Icon size={14} aria-hidden="true" />
      <span>{pct(value, digits)}</span>
      <span className="sr-only">{d === "up" ? "naik" : d === "down" ? "turun" : "tetap"}</span>
    </span>
  );
}

export function Sparkline({ data, up, width = 96, height = 28 }: { data: number[] | null | undefined; up?: boolean; width?: number; height?: number }) {
  if (!data || data.length < 2) return <span style={{ width, height }} className="inline-block" aria-hidden="true" />;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`).join(" ");
  const rising = up ?? data[data.length - 1] >= data[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={rising ? "Tren naik" : "Tren turun"}>
      <polyline points={pts} fill="none" stroke={rising ? "var(--up)" : "var(--down)"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Section({ title, lead, action, children, id }: { title: string; lead?: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="section">
      <div className="container-x">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2>{title}</h2>
            {lead && <p className="mt-2 text-muted">{lead}</p>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

export function PageHead({ title, lead, stamp }: { title: ReactNode; lead?: ReactNode; stamp?: string | null }) {
  return (
    <div className="mb-6">
      <h1>{title}</h1>
      {lead && <p className="mt-2 max-w-2xl text-muted">{lead}</p>}
      {stamp !== undefined && <Stamp date={stamp} />}
    </div>
  );
}

export function Stamp({ date, demo }: { date: string | null | undefined; demo?: boolean }) {
  return (
    <p className="mt-2 text-[13px] leading-5 text-muted">
      Data per {date ? dateId(date) : "–"}{demo ? " · DATA DEMO (sintetis, bukan data pasar sebenarnya)" : ""}
    </p>
  );
}

export function Disclaimer({ className = "" }: { className?: string }) {
  return <p className={`text-[13px] leading-5 text-muted ${className}`}>{DISCLAIMER}</p>;
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function Empty({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="card text-center">
      <p className="text-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Baris/kartu terkunci: satu kalimat penjelas + satu tindakan. */
export function Locked({ text, href = "/harga", cta = "Lihat paket" }: { text: string; href?: string; cta?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-[15px] text-muted"><Lock size={16} aria-hidden="true" /> {text}</p>
      <Link className="btn" href={href}>{cta}</Link>
    </div>
  );
}

export function Banner({ level, children }: { level: "info" | "warning" | "critical"; children: ReactNode }) {
  const cls = level === "info" ? "bg-brand-soft" : "bg-[var(--warn-bg)] text-[var(--warn-fg)]";
  return <div role="status" className={`${cls} px-4 py-2 text-center text-[14px]`}>{children}</div>;
}
