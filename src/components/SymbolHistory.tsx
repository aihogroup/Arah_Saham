"use client";

import { useEffect, useMemo, useState } from "react";
import Chart, { type Point } from "@/components/Chart";
import Seasonality from "@/components/Seasonality";
import { T, useT } from "@/components/T";
import { Delta } from "@/components/ui";
import { cached, rpcPaged } from "@/lib/client-cache";
import { dateId } from "@/lib/format";
import type { Key } from "@/lib/i18n";
import { mprice } from "@/lib/market";
import { createClient } from "@/lib/supabase/client";

type Row = { trade_date: string; close: number; change_pct: number | null };
const PERIODS: { days: number; k: Key }[] = [
  { days: 30, k: "per.1m" }, { days: 90, k: "per.3m" }, { days: 180, k: "per.6m" }, { days: 365, k: "per.1y" }, { days: 1825, k: "per.5y" }, { days: 0, k: "per.max" },
];
const PAGE = 25;

const toRows = (rows: { trade_date: string; close: number | string; change_pct: number | string | null }[]): Row[] =>
  rows.map((r) => ({ trade_date: r.trade_date, close: Number(r.close), change_pct: r.change_pct === null ? null : Number(r.change_pct) }));

/** Grafik dan riwayat harian satu instrumen pasar. Rentang lain dimuat dari database sekali lalu disimpan di cache klien. */
export default function SymbolHistory({ symbol, name, initial, initialDays }: { symbol: string; name: string; initial: Row[]; initialDays: number }) {
  const t = useT();
  const [days, setDays] = useState(initialDays);
  const [rows, setRows] = useState<Row[]>(initial);
  const [shown, setShown] = useState(PAGE);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (days === initialDays) { setRows(initial); return; }
    let live = true;
    setLoading(true); setErr(null);
    cached(`msym:${symbol}:${days}`, () => rpcPaged<Row>((a, b) => createClient().rpc("market_series", { p_symbol: symbol, p_days: days }).range(a, b)), 10 * 60_000)
      .then((r) => { if (live) { setRows(toRows(r ?? [])); setLoading(false); } })
      .catch(() => { if (live) { setErr("Gagal memuat riwayat. Coba lagi."); setLoading(false); } });
    return () => { live = false; };
  }, [days, symbol, initial, initialDays]);

  const points: Point[] = useMemo(() => rows.map((r) => ({ time: r.trade_date, value: r.close })), [rows]);
  const stats = useMemo(() => {
    if (!rows.length) return null;
    let hi = rows[0], lo = rows[0];
    for (const r of rows) { if (r.close > hi.close) hi = r; if (r.close < lo.close) lo = r; }
    return { hi, lo, change: (rows[rows.length - 1].close / rows[0].close - 1) * 100 };
  }, [rows]);
  const desc = useMemo(() => [...rows].reverse(), [rows]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("market.period")}>
            {PERIODS.map((p) => <button key={p.days} type="button" className="chip" aria-pressed={days === p.days} onClick={() => { setDays(p.days); setShown(PAGE); }}><T k={p.k} /></button>)}
          </div>
          {stats && <p className="text-[14px] text-muted"><T k="market.perf" />: <Delta value={stats.change} /></p>}
        </div>
        <div className="mt-4" aria-busy={loading}>
          {points.length ? <Chart data={points} height={340} label={`${name}`} /> : <p className="py-16 text-center text-muted">{loading ? "Memuat…" : "Data belum tersedia."}</p>}
        </div>
        {err && <p role="alert" className="mt-2 text-[14px] down">{err}</p>}
        {stats && (
          <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-3">
            <div><dt className="text-muted"><T k="market.high" /></dt><dd className="font-medium">{mprice(stats.hi.close)} <span className="text-[12px] text-muted">({dateId(stats.hi.trade_date, { day: "numeric", month: "short", year: "numeric" })})</span></dd></div>
            <div><dt className="text-muted"><T k="market.low" /></dt><dd className="font-medium">{mprice(stats.lo.close)} <span className="text-[12px] text-muted">({dateId(stats.lo.trade_date, { day: "numeric", month: "short", year: "numeric" })})</span></dd></div>
            <div><dt className="text-muted"><T k="market.range" /></dt><dd className="font-medium">{rows.length.toLocaleString("id-ID")} <T k="market.days" /></dd></div>
          </dl>
        )}
        <Seasonality source="market" symbol={symbol} />
      </div>

      <section className="card" aria-labelledby="h-riwayat">
        <h2 id="h-riwayat" className="text-[20px] leading-7"><T k="market.history" /></h2>
        <div className="mt-3 overflow-x-auto">
          <table className="data">
            <thead><tr><th><T k="col.date" /></th><th className="r"><T k="col.close" /></th><th className="r"><T k="col.change" /></th></tr></thead>
            <tbody>
              {desc.slice(0, shown).map((r) => (
                <tr key={r.trade_date}><td>{dateId(r.trade_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</td><td className="r">{mprice(r.close)}</td><td className="r"><Delta value={r.change_pct} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown < desc.length && <div className="mt-4 text-center"><button type="button" className="btn" onClick={() => setShown((s) => s + PAGE * 4)}><T k="market.loadMore" /> ({desc.length - shown})</button></div>}
      </section>
    </div>
  );
}
