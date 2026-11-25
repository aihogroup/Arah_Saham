// Atom: komponen terkecil tanpa status dan tanpa ketergantungan pada komponen lain.
// Aman dipakai di komponen server maupun klien.
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { dir, pct } from "@/lib/format";

export type Tone = "neutral" | "brand" | "up" | "down" | "warn" | "premium";

/** Perubahan harga: selalu panah + tanda +/− (tidak hanya warna, WCAG 1.4.1). */
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

/** Grafik garis mini (SVG, tajam di layar berkepadatan tinggi). */
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

/** Lencana status kecil. Nada diatur lewat data-tone (lihat .badge di styles/components.css). */
export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`badge ${className}`} data-tone={tone === "neutral" ? undefined : tone}>{children}</span>;
}

/** Kerangka muat: menahan tempat agar tata letak tidak bergeser (CLS) saat data tiba. */
export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Bilah kemajuan tugas (Efek Zeigarnik). */
export function ProgressBar({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  const v = Math.max(0, Math.min(value, max));
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={v}>
      <span style={{ width: `${(v / max) * 100}%` }} />
    </div>
  );
}
