"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Locked, Skeleton } from "@/components/ui";
import { cached, rpcData } from "@/lib/client-cache";
import { compact, dateId } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Acc = { n: number; hit_rate: number | null; baseline_rate: number | null; mae?: number | null; since?: string | null };
type Fc = { made_on: string; target_date: string | null; direction: string; confidence: number; pred_return: number; reasons: { feature: string; contribution: number }[] } | null;
type Latest = { code: string; locked: boolean; forecast: Fc; accuracy: Acc; accuracy_90d: Acc; in_universe: boolean };
type Month = { ym: string; n: number; hits: number; hit_rate: number | null; baseline_rate: number | null };
type Ev = { made_on: string; target_date: string | null; pred_dir: string; pred_return: number; actual_return: number; hit: boolean | null };
type Tier = { tier: string; n: number; hit_rate: number };
type Flt = { free_float_pct: number | null; float_known: boolean; mcap: number | null; float_mcap: number | null; avg_value_20d: number | null; turnover_float: number | null; vol20: number | null; pump_score: number; risk_label: string; float_source: string | null; as_of: string | null };

const FEATURE: Record<string, string> = {
  ret1: "Perubahan harga hari ini", ret5: "Tren 5 hari", ret20: "Tren 20 hari", vol20: "Volatilitas 20 hari", value_ratio: "Nilai transaksi dibanding biasanya",
  freq_ratio: "Frekuensi transaksi dibanding biasanya", foreign_ratio: "Net asing", range_pos: "Posisi penutupan dalam rentang harian", gap: "Gap pembukaan",
  adr_ret: "Pergerakan ADR/OTC di luar negeri", etf_ret: "Pergerakan ETF Indonesia (EIDO)", usd_ret: "Pergerakan USD/IDR", ihsg_ret1: "IHSG hari ini", ihsg_mom5: "Tren IHSG 5 hari",
  g_broker_value: "Nilai transaksi broker", g_broker_volume: "Volume transaksi broker", g_broker_frequency: "Frekuensi transaksi broker", g_komoditas: "Komoditas", g_kurs: "Kurs",
  g_indeks_global: "Indeks global", g_proksi_id: "Proksi Indonesia di luar negeri", breadth_ratio: "Kekuatan pasar (naik vs turun)", pct_above_ma20: "Saham di atas rata-rata 20 hari",
  seas_dow: "Pola hari dalam pekan", seas_month: "Pola bulanan",
};
const pc = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "–" : (v * 100).toFixed(d).replace(".", ",") + "%");
const RISK_CLS: Record<string, string> = { tinggi: "down", sedang: "text-foreground", rendah: "up" };
const RISK_TXT: Record<string, string> = { tinggi: "Rawan digoreng", sedang: "Waspada sedang", rendah: "Relatif sulit digoreng" };

export function PumpBadge({ label, score }: { label: string; score: number }) {
  return <span className={`chip ${RISK_CLS[label] ?? ""}`} title={`Skor risiko ${score} dari 100`}>{RISK_TXT[label] ?? label} · {score}</span>;
}

/** Prediksi per saham + riwayat akurasi + analisis free float. Data akurasi terbuka; arah besok khusus premium. */
export default function StockInsight({ code }: { code: string }) {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [months, setMonths] = useState<Month[] | null>(null);
  const [evals, setEvals] = useState<Ev[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [flt, setFlt] = useState<Flt | null | undefined>(undefined);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    setErr(false); setLatest(null); setMonths(null); setFlt(undefined);
    const sb = createClient();
    Promise.all([
      rpcData<Latest>(sb.rpc("stock_forecast_latest", { p_code: code })),
      cached(`sacc:${code}`, () => rpcData<Month[]>(sb.rpc("stock_accuracy_history", { p_code: code, p_months: 24 })), 10 * 60_000),
      cached(`sev:${code}`, () => rpcData<Ev[]>(sb.rpc("stock_recent_evals", { p_code: code, p_limit: 20 })), 10 * 60_000),
      cached("stiers", () => rpcData<Tier[]>(sb.rpc("stock_accuracy_tiers")), 30 * 60_000),
      cached(`sflt:${code}`, () => rpcData<Flt | null>(sb.rpc("stock_float_detail", { p_code: code })), 10 * 60_000),
    ]).then(([l, m, e, t, f]) => { if (live) { setLatest(l); setMonths(m ?? []); setEvals(e ?? []); setTiers(t ?? []); setFlt(f ?? null); } })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [code]);

  if (err) return <p className="text-muted">Analisis tambahan belum dapat dimuat.</p>;
  if (!latest || months === null || flt === undefined) return <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;

  const a = latest.accuracy; const a90 = latest.accuracy_90d;
  const naive = a.baseline_rate === null ? null : Math.max(a.baseline_rate, 1 - a.baseline_rate); // tebakan terbaik tanpa model: selalu naik atau selalu turun
  const edge = a.hit_rate !== null && naive !== null ? a.hit_rate - naive : null;
  const f = latest.forecast;
  const shown = [...months].reverse().slice(-12);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-4" aria-labelledby="h-prediksi">
        <h3 id="h-prediksi">Prediksi arah harian dan riwayat akurasi</h3>
        {!latest.in_universe ? (
          <p className="text-muted">Saham ini belum masuk cakupan model. Prediksi per saham hanya dibuat untuk saham likuid agar hasilnya tidak menyesatkan.</p>
        ) : (
          <>
            {latest.locked ? (
              <Locked text="Arah prediksi hari bursa berikutnya untuk saham ini tersedia di paket premium. Riwayat akurasi di bawah terbuka untuk semua." />
            ) : f ? (
              <div role="status" className="rounded-xl border border-line p-3">
                <p className="text-meta text-muted">Dibuat {dateId(f.made_on)} untuk {f.target_date ? dateId(f.target_date) : "hari bursa berikutnya"}</p>
                <p className="mt-1 text-xl font-semibold"><span className={f.direction === "naik" ? "up" : "down"}>{f.direction === "naik" ? "▲ Cenderung naik" : "▼ Cenderung turun"}</span> <span className="text-sm font-normal text-muted">keyakinan {pc(f.confidence, 0)}</span></p>
                <p className="mt-1 text-meta text-muted">Faktor terbesar: {f.reasons.map((r) => FEATURE[r.feature] ?? r.feature).join(", ")}.</p>
              </div>
            ) : <p className="text-muted">Prediksi terbaru belum tersedia.</p>}

            {a.n > 0 ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body">
                <dt className="text-muted">Akurasi arah (semua)</dt><dd className="text-end font-medium">{pc(a.hit_rate)} <span className="text-meta font-normal text-muted">dari {a.n} hari</span></dd>
                <dt className="text-muted">Tebakan terbaik tanpa model</dt><dd className="text-end">{pc(naive)}</dd>
                <dt className="text-muted">90 hari terakhir</dt><dd className="text-end">{pc(a90.hit_rate)}</dd>
              </dl>
            ) : <p className="text-muted">Riwayat evaluasi belum cukup.</p>}

            <details>
              <summary className="cursor-pointer text-sm text-brand">Rincian akurasi</summary>
              <div className="mt-3 space-y-4">
            {edge !== null && <p className="text-sm">Selisih terhadap tebakan terbaik tanpa model: <span className={edge > 0 ? "up" : "down"}>{(edge > 0 ? "+" : "") + (edge * 100).toFixed(1).replace(".", ",")} poin</span>. Galat rata-rata {pc(a.mae ?? null, 2)} per hari.</p>}
            {shown.length > 0 && (
              <div>
                <p className="mb-2 text-meta text-muted">Akurasi per bulan (garis = persentase hari saham naik)</p>
                <ul className="space-y-1" aria-label="Akurasi per bulan">
                  {shown.map((m) => (
                    <li key={m.ym} className="flex items-center gap-2 text-meta">
                      <span className="w-16 shrink-0 text-muted">{new Date(m.ym + "T00:00:00Z").toLocaleDateString("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" })}</span>
                      <span className="relative h-3 flex-1 rounded bg-surface" title={`${pc(m.hit_rate)} dari ${m.n} hari`}>
                        <span className="absolute inset-y-0 start-0 rounded bg-brand" style={{ width: `${Math.round((m.hit_rate ?? 0) * 100)}%` }} />
                        {m.baseline_rate !== null && <span className="absolute inset-y-[-2px] w-0.5 bg-foreground" style={{ left: `${Math.round(m.baseline_rate * 100)}%` }} />}
                      </span>
                      <span className="w-12 shrink-0 text-end">{pc(m.hit_rate, 0)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tiers.length > 0 && (
              <p className="text-meta text-muted">Seluruh saham dalam cakupan: akurasi naik bersama keyakinan model. {[...tiers].reverse().map((t) => `keyakinan ${t.tier === "<55" ? "di bawah 55%" : t.tier === "65+" ? "65% ke atas" : t.tier.replace("-", "–") + "%"}: ${pc(t.hit_rate, 0)} (${Number(t.n).toLocaleString("id-ID")} hari)`).join("; ")}.</p>
            )}

            {evals.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm text-brand">Evaluasi terbaru ({evals.length} hari)</summary>
                <ul className="mt-2 divide-y divide-line text-meta">
                  {evals.map((e) => (
                    <li key={e.made_on} className="flex min-h-[36px] items-center justify-between gap-2">
                      <span>{dateId(e.target_date ?? e.made_on, { day: "numeric", month: "short" })}</span>
                      <span className="text-muted">prediksi {e.pred_dir}</span>
                      <span className={e.actual_return >= 0 ? "up" : "down"}>{pc(e.actual_return, 2)}</span>
                      <span aria-label={e.hit ? "benar" : "salah"} className={e.hit ? "up" : "down"}>{e.hit ? "✔" : "✘"}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
              </div>
            </details>
            <p className="text-caption text-muted">Akurasi dihitung walk-forward: tiap prediksi hanya memakai data sebelum hari itu. Memprediksi arah satu hari ke depan sangat sulit; angka di dekat 50% adalah hal wajar dan bukan jaminan hasil.</p>
          </>
        )}
      </section>

      <section className="card space-y-4" aria-labelledby="h-ff">
        <h3 id="h-ff">Free float dan risiko “gorengan”</h3>
        {!flt ? <p className="text-muted">Data likuiditas belum tersedia untuk saham ini.</p> : (
          <>
            <p><PumpBadge label={flt.risk_label} score={flt.pump_score} /></p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body">
              <dt className="text-muted">Free float</dt><dd className="text-end font-medium">{flt.float_known && flt.free_float_pct !== null ? `${Number(flt.free_float_pct).toFixed(2).replace(".", ",")}%` : "Belum diketahui"}</dd>
              <dt className="text-muted">Kapitalisasi free float</dt><dd className="text-end">{compact(flt.float_mcap)}</dd>
              <dt className="text-muted">Rata-rata transaksi 20 hari</dt><dd className="text-end">{compact(flt.avg_value_20d)}</dd>
            </dl>
            <details>
              <summary className="cursor-pointer text-sm text-brand">Rincian angka</summary>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted">Kapitalisasi pasar</dt><dd className="text-end">{compact(flt.mcap)}</dd>
                <dt className="text-muted">Perputaran terhadap float</dt><dd className="text-end">{flt.turnover_float === null ? "–" : pc(flt.turnover_float, 2) + " per hari"}</dd>
                <dt className="text-muted">Volatilitas harian (20 hari)</dt><dd className="text-end">{pc(flt.vol20, 2)}</dd>
              </dl>
            </details>
            <p className="text-meta text-muted">
              Free float besar dan transaksi tinggi membuat saham lebih likuid dan sulit digerakkan segelintir pihak. {!flt.float_known ? "Free float belum tercatat; skor memakai nilai tengah. " : ""}Skor adalah heuristik, bukan tuduhan manipulasi.
            </p>
            <Link href="/free-float" className="text-sm text-brand underline">Bandingkan semua saham berdasarkan free float</Link>
          </>
        )}
      </section>
    </div>
  );
}
