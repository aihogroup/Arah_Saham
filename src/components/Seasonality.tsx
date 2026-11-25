"use client";

import { useEffect, useMemo, useState } from "react";
import { T, useLang, useT } from "@/components/T";
import { cached, rpcData } from "@/lib/client-cache";
import { createClient } from "@/lib/supabase/client";

type Source = "market" | "index" | "stock";
type MonthRow = { yr: number; mo: number; ret: number | string | null };
type DowRow = { dow: number; n: number | string; up: number | string; down: number | string; avg_ret: number | string | null };

const fmt = (v: number | null, d = 2) => (v === null || Number.isNaN(v) ? "" : v.toFixed(d).replace(".", ","));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Warna sel: hijau/merah (mengikuti palet --up/--down, termasuk mode buta warna) dengan intensitas sebanding besar nilai. */
function tint(v: number | null, scale: number): React.CSSProperties | undefined {
  if (v === null || v === 0) return undefined;
  const p = Math.round(Math.min(1, Math.abs(v) / scale) * 65 + 8);
  return { background: `color-mix(in srgb, var(${v > 0 ? "--up" : "--down"}) ${p}%, var(--background))` };
}

/** Seasonality di bawah grafik: heatmap perubahan bulanan per tahun, dan rata-rata per hari dalam pekan. */
export default function Seasonality({ source, symbol }: { source: Source; symbol: string }) {
  const t = useT();
  const lang = useLang();
  const [tab, setTab] = useState<"monthly" | "weekday">("monthly");
  const [years, setYears] = useState(5);
  const [months, setMonths] = useState<MonthRow[] | null>(null);
  const [dows, setDows] = useState<DowRow[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    setMonths(null); setDows(null); setErr(false);
    const sb = createClient();
    Promise.all([
      cached(`seas:m:${source}:${symbol}`, () => rpcData<MonthRow[]>(sb.rpc("seasonality", { p_source: source, p_key: symbol })), 30 * 60_000),
      cached(`seas:d:${source}:${symbol}`, () => rpcData<DowRow[]>(sb.rpc("seasonality_dow", { p_source: source, p_key: symbol })), 30 * 60_000),
    ]).then(([m, d]) => { if (live) { setMonths(m ?? []); setDows(d ?? []); } }).catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [source, symbol]);

  const loc = lang === "en" ? "en-US" : "id-ID";
  const monthNames = useMemo(() => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(loc, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, i, 1)))), [loc]);
  const dayNames = useMemo(() => Array.from({ length: 5 }, (_, i) => new Intl.DateTimeFormat(loc, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i)))), [loc]);

  const grid = useMemo(() => {
    if (!months || months.length === 0) return null;
    const all = [...new Set(months.map((m) => m.yr))].sort((a, b) => b - a);
    const ys = years === 0 ? all : all.slice(0, years);
    const map = new Map<string, number>();
    for (const m of months) if (m.ret !== null) map.set(`${m.yr}-${m.mo}`, Number(m.ret));
    const cell = (y: number, mo: number) => map.get(`${y}-${mo}`) ?? null;
    const yearly = (y: number) => {
      const vs = Array.from({ length: 12 }, (_, i) => cell(y, i + 1)).filter((v): v is number => v !== null);
      return vs.length ? (vs.reduce((a, r) => a * (1 + r / 100), 1) - 1) * 100 : null;
    };
    const cols = Array.from({ length: 12 }, (_, i) => ys.map((y) => cell(y, i + 1)).filter((v): v is number => v !== null));
    const yv = ys.map(yearly).filter((v): v is number => v !== null);
    const allVals = [...cols.flat()].map(Math.abs).sort((a, b) => a - b);
    const scale = Math.max(2, allVals[Math.floor(allVals.length * 0.9)] ?? 5);
    return { ys, cell, yearly, cols, yv, scale, yscale: Math.max(5, ...yv.map(Math.abs).sort((a, b) => a - b).slice(0, Math.max(1, Math.floor(yv.length * 0.9)))) };
  }, [months, years]);

  const col = (xs: number[]) => ({ avg: mean(xs), up: xs.filter((v) => v > 0).length, down: xs.filter((v) => v < 0).length, total: xs.length });
  const th = "px-2 py-2 text-center text-caption font-medium text-muted";
  const td = "px-2 py-1.5 text-center text-meta tabular-nums";

  return (
    <section className="mt-6 border-t border-line pt-5" aria-labelledby={`seas-${symbol}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={`seas-${symbol}`} className="text-lg leading-7"><T k="seas.title" /></h3>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-2" role="group" aria-label="Jenis seasonality">
            <button type="button" className="chip" aria-pressed={tab === "monthly"} onClick={() => setTab("monthly")}><T k="seas.monthly" /></button>
            <button type="button" className="chip" aria-pressed={tab === "weekday"} onClick={() => setTab("weekday")}><T k="seas.weekday" /></button>
          </div>
          {tab === "monthly" && (
            <div className="flex gap-2" role="group" aria-label={t("seas.years")}>
              {[5, 10, 0].map((y) => <button key={y} type="button" className="chip" aria-pressed={years === y} onClick={() => setYears(y)}>{y === 0 ? t("seas.all") : `${y} ${lang === "en" ? "yrs" : "thn"}`}</button>)}
            </div>
          )}
        </div>
      </div>
      <p className="mt-1 text-caption text-muted"><T k="seas.lead" /></p>

      {err && <p role="alert" className="mt-3 text-sm down"><T k="seas.error" /></p>}
      {!err && months === null && <p role="status" className="mt-3 text-sm text-muted"><T k="seas.loading" /></p>}
      {!err && months !== null && !grid && <p className="mt-3 text-sm text-muted"><T k="seas.none" /></p>}

      {grid && tab === "monthly" && (
        <div className="mt-3 table-scroll">
          <table className="w-full min-w-[640px] border-collapse">
            <thead><tr><th className={`${th} text-start`}></th>{monthNames.map((m) => <th key={m} className={th}>{m}</th>)}<th className={th}><T k="seas.year" /></th></tr></thead>
            <tbody>
              <tr className="border-t border-line"><th scope="row" className={`${td} text-start font-semibold`}><T k="seas.avg" /></th>
                {grid.cols.map((c, i) => { const a = col(c).avg; return <td key={i} className={`${td} font-semibold`} style={tint(a, grid.scale)}>{fmt(a)}</td>; })}
                {(() => { const a = mean(grid.yv); return <td className={`${td} font-semibold`} style={tint(a, grid.yscale)}>{fmt(a)}</td>; })()}</tr>
              {grid.ys.map((y) => (
                <tr key={y} className="border-t border-line"><th scope="row" className={`${td} text-start font-medium`}>{y}</th>
                  {Array.from({ length: 12 }, (_, i) => { const v = grid.cell(y, i + 1); return <td key={i} className={td} style={tint(v, grid.scale)}>{fmt(v)}</td>; })}
                  {(() => { const v = grid.yearly(y); return <td className={`${td} font-medium`} style={tint(v, grid.yscale)}>{fmt(v)}</td>; })()}</tr>
              ))}
              {(["up", "down", "total"] as const).map((k) => (
                <tr key={k} className={k === "up" ? "border-t-2 border-line" : "border-t border-line"}><th scope="row" className={`${td} text-start font-medium`}><T k={k === "up" ? "seas.up" : k === "down" ? "seas.down" : "seas.total"} /></th>
                  {grid.cols.map((c, i) => <td key={i} className={td}>{col(c)[k]}</td>)}
                  <td className={td}>{k === "up" ? grid.yv.filter((v) => v > 0).length : k === "down" ? grid.yv.filter((v) => v < 0).length : grid.yv.length}</td></tr>
              ))}
              <tr className="border-t border-line"><th scope="row" className={`${td} text-start font-semibold`}><T k="seas.prob" /></th>
                {grid.cols.map((c, i) => { const s = col(c); const p = s.total ? (s.up / s.total) * 100 : null; return <td key={i} className={`${td} font-semibold`} style={tint(p === null ? null : p - 50, 50)}>{p === null ? "" : `${Math.round(p)}%`}</td>; })}
                {(() => { const n = grid.yv.length; const p = n ? (grid.yv.filter((v) => v > 0).length / n) * 100 : null; return <td className={`${td} font-semibold`} style={tint(p === null ? null : p - 50, 50)}>{p === null ? "" : `${Math.round(p)}%`}</td>; })()}</tr>
            </tbody>
          </table>
        </div>
      )}

      {grid && tab === "weekday" && dows && (
        <div className="mt-3 table-scroll">
          <table className="data min-w-[520px]">
            <thead><tr><th><T k="seas.day" /></th><th className="r"><T k="seas.avgChange" /></th><th className="r"><T k="seas.up" /></th><th className="r"><T k="seas.down" /></th><th className="r"><T k="seas.total" /></th><th className="r"><T k="seas.prob" /></th></tr></thead>
            <tbody>
              {dows.map((d) => {
                const avg = d.avg_ret === null ? null : Number(d.avg_ret), up = Number(d.up), down = Number(d.down), n = Number(d.n);
                const p = up + down ? (up / (up + down)) * 100 : null;
                return (
                  <tr key={d.dow}><td className="font-medium">{dayNames[d.dow - 1]}</td>
                    <td className="r" style={tint(avg, 0.25)}>{avg === null ? "" : `${avg > 0 ? "+" : ""}${fmt(avg, 3)}%`}</td>
                    <td className="r">{up}</td><td className="r">{down}</td><td className="r">{n}</td>
                    <td className="r" style={tint(p === null ? null : p - 50, 25)}>{p === null ? "" : `${Math.round(p)}%`}</td></tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
