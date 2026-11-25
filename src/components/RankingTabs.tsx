"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Delta, Empty, Locked, Skeleton, Sparkline } from "@/components/ui";
import { useSignedIn } from "@/components/useSignedIn";
import { createClient } from "@/lib/supabase/client";
import { cached, rpcData } from "@/lib/client-cache";
import { compact, dateId, price } from "@/lib/format";
import { BOARDS, INDEXES, SECTORS, SECTOR_LABEL } from "@/lib/nav";
import { METRICS, PRESETS, activePreset, presetRange, toRankRow, type MetricId, type RankFilter, type RankRow } from "@/lib/ranking";

const FIRST_DATE = "2020-01-02"; // data harian IDX tersedia sejak tanggal ini
const sel = "input !h-10 !min-h-0 w-auto py-0 text-sm";

function Metric({ m, r }: { m: MetricId; r: RankRow }) {
  switch (m) {
    case "gainer": case "loser": return <Delta value={r.change_pct} />;
    case "value": return <>{compact(r.value)}</>;
    case "volume": return <>{compact(r.volume)}</>;
    case "frequency": return <>{compact(r.frequency)}</>;
    case "foreign_buy": return <span className="up">{compact(r.foreign_buy)}</span>;
    case "foreign_sell": return <span className="down">{compact(r.foreign_sell)}</span>;
    case "net_foreign_buy": case "net_foreign_sell": return <span className={r.net_foreign >= 0 ? "up" : "down"}>{r.net_foreign >= 0 ? "▲ +" : "▼ −"}{compact(Math.abs(r.net_foreign))}</span>;
    default: return <>{r.free_float_pct === null ? "–" : `${r.free_float_pct.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`}</>;
  }
}

/** Peringkat saham: 11 metrik, satu hari atau rentang tanggal, filter papan/sektor/indeks. Pengunjung melihat hari terakhir saja. */
export default function RankingTabs({ initial, initialFilter, latest, dates }: { initial: RankRow[]; initialFilter: RankFilter; latest: string; dates?: { from: string; to: string } }) {
  const signedIn = useSignedIn();
  const [f, setF] = useState<RankFilter>({ ...initialFilter, from: dates?.from ?? "", to: dates?.to ?? "" });
  const [rows, setRows] = useState<RankRow[]>(initial);
  const [limit, setLimit] = useState(10);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (p: Partial<RankFilter>) => { setLimit(10); setF((x) => ({ ...x, ...p })); };
  const metric = METRICS.find((m) => m.id === f.metric) ?? METRICS[0];
  const preset = activePreset(latest, f.from, f.to);
  const dated = !!(f.from || f.to);
  const sameAsInitial = f.metric === initialFilter.metric && f.board === initialFilter.board && f.sector === initialFilter.sector && f.index === initialFilter.index && !dated && limit === 10;

  // Alamat halaman ikut berubah agar tampilan bisa dibagikan.
  useEffect(() => {
    const p = new URLSearchParams();
    if (f.metric !== "gainer") p.set("jenis", f.metric);
    if (f.board) p.set("papan", f.board); if (f.sector) p.set("sektor", f.sector); if (f.index) p.set("indeks", f.index);
    if (signedIn) { if (f.from) p.set("dari", f.from); if (f.to) p.set("sampai", f.to); }
    const q = p.toString();
    window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
  }, [f, signedIn]);

  useEffect(() => {
    if (sameAsInitial) { setRows(initial); setErr(null); return; }
    if (dated && signedIn === null) return; // tunggu status login sebelum meminta rentang
    let live = true;
    setLoading(true);
    const args = { p_metric: f.metric, p_from: signedIn && f.from ? f.from : null, p_to: signedIn && (f.to || f.from) ? f.to || f.from : null, p_board: f.board || null, p_sector: f.sector || null, p_index: f.index || null, p_limit: limit };
    cached(`rk:${signedIn ? 1 : 0}:${JSON.stringify(args)}`, () => rpcData<Record<string, unknown>[]>(createClient().rpc("rank_stocks", args)))
      .then((data) => { if (live) { setLoading(false); setErr(null); setRows((data ?? []).map(toRankRow)); } })
      .catch(() => { if (live) { setLoading(false); setErr("Gagal memuat peringkat."); } });
    return () => { live = false; };
  }, [f, limit, signedIn, dated, sameAsInitial, initial]);

  const period = useMemo(() => {
    const r = rows[0]; if (!r) return null;
    const d = (x: string) => dateId(x, { day: "numeric", month: "short", year: "numeric" });
    return r.from_date === r.to_date ? d(r.to_date) : `${d(r.from_date)} – ${d(r.to_date)} (${r.days} hari bursa)`;
  }, [rows]);
  const showChg = f.metric !== "gainer" && f.metric !== "loser";
  const showValue = f.metric !== "value";

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Jenis peringkat">
        {METRICS.map((m) => <button key={m.id} type="button" className="chip" aria-pressed={f.metric === m.id} onClick={() => set({ metric: m.id })}>{m.label}</button>)}
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-line p-3 sm:p-4">
        <div>
          <p className="mb-1.5 text-meta font-medium text-muted">Waktu</p>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="chip" aria-pressed={preset === p.id} disabled={p.id !== "last" && !signedIn}
                title={p.id !== "last" && !signedIn ? "Masuk untuk memilih rentang waktu" : undefined}
                onClick={() => { const r = presetRange(latest, p.id); set({ from: r.from, to: r.to }); }}>{p.label}</button>
            ))}
            <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
            <label className="flex items-center gap-1.5 text-sm">Dari
              <input type="date" className={sel} min={FIRST_DATE} max={latest} value={f.from} disabled={!signedIn} aria-label="Tanggal awal" onChange={(e) => set({ from: e.target.value, to: f.to || e.target.value })} />
            </label>
            <label className="flex items-center gap-1.5 text-sm">Sampai
              <input type="date" className={sel} min={f.from || FIRST_DATE} max={latest} value={f.to} disabled={!signedIn} aria-label="Tanggal akhir" onChange={(e) => set({ to: e.target.value, from: f.from || e.target.value })} />
            </label>
          </div>
          <p className="mt-1.5 text-caption text-muted">Untuk satu hari, isi tanggal yang sama pada kedua kolom. Perubahan harga pada rentang dihitung dari penutupan sebelum hari pertama hingga penutupan hari terakhir.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-meta font-medium text-muted">Papan
            <select className={sel} value={f.board} onChange={(e) => set({ board: e.target.value })}><option value="">Semua papan</option>{BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}</select>
          </label>
          <label className="grid gap-1 text-meta font-medium text-muted">Sektor
            <select className={sel} value={f.sector} onChange={(e) => set({ sector: e.target.value })}><option value="">Semua sektor</option>{SECTORS.map((s) => <option key={s} value={s}>{SECTOR_LABEL[s] ?? s}</option>)}</select>
          </label>
          <label className="grid gap-1 text-meta font-medium text-muted">Indeks
            <select className={sel} value={f.index} onChange={(e) => set({ index: e.target.value })}><option value="">Semua saham</option>{INDEXES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>
          </label>
          {(f.board || f.sector || f.index || dated) && <button type="button" className="btn btn-ghost" onClick={() => set({ board: "", sector: "", index: "", from: "", to: "" })}>Atur ulang</button>}
        </div>
      </div>

      <p className="mt-3 text-meta text-muted" role="status">{period ? <>Periode: <strong className="font-medium text-foreground">{period}</strong>{f.metric.startsWith("free_float") ? " · free float hanya tersedia untuk sebagian saham" : ""}</> : loading ? "Memuat…" : ""}</p>

      <div className="mt-2 table-scroll">
        <table className="data" aria-busy={loading}>
          <thead><tr><th>#</th><th>Kode</th><th className="hidden sm:table-cell">Nama</th><th className="r">Harga</th>
            {showChg && <th className="r hidden sm:table-cell">Perubahan</th>}
            <th className="r">{metric.col}</th>
            {showValue && <th className="r hidden md:table-cell">Nilai</th>}
            <th className="r hidden md:table-cell"><span className="sr-only">Tren</span></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.stock_code}>
                <td className="text-muted">{i + 1}</td>
                <td><Link href={`/saham/${r.stock_code}`} className="font-medium text-brand">{r.stock_code}</Link>{r.board && r.board !== "Utama" && <span className="ms-1.5 text-caption text-muted">{r.board}</span>}</td>
                <td className="hidden max-w-[240px] truncate sm:table-cell">{r.name}</td>
                <td className="r">{price(r.close)}</td>
                {showChg && <td className="r hidden sm:table-cell"><Delta value={r.change_pct} /></td>}
                <td className="r font-medium"><Metric m={f.metric} r={r} /></td>
                {showValue && <td className="r hidden md:table-cell">{compact(r.value)}</td>}
                <td className="r hidden md:table-cell"><Sparkline data={r.spark} width={64} height={22} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && rows.length === 0 && <div className="space-y-2 pt-2" role="status" aria-label="Memuat peringkat">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
        {!loading && rows.length === 0 && !err && (
          <div className="mt-3"><Empty title="Tidak ada hasil" message="Tidak ada saham yang cocok dengan filter dan periode ini."
            action={(f.board || f.sector || f.index || dated) ? <button type="button" className="btn" onClick={() => set({ board: "", sector: "", index: "", from: "", to: "" })}>Atur ulang filter</button> : undefined} /></div>
        )}
      </div>
      {err && <p role="alert" className="mt-2 flex flex-wrap items-center gap-2 down">{err} <button type="button" className="btn btn-sm" onClick={() => set({})}>Coba lagi</button></p>}
      {signedIn && limit < 100 && rows.length >= 10 && <div className="mt-4 text-center"><button className="btn" onClick={() => setLimit(100)}>Lihat 100 teratas</button></div>}
      {signedIn === false && <div className="mt-4"><Locked text="Masuk (gratis) untuk memilih tanggal atau rentang waktu dan melihat 100 peringkat teratas. Filter papan, sektor, dan indeks terbuka untuk semua." href="/masuk" cta="Masuk" /></div>}
    </div>
  );
}
