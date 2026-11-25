"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Delta, Empty, Locked, Skeleton, Sparkline } from "@/components/ui";
import { useSignedIn } from "@/components/useSignedIn";
import { createClient } from "@/lib/supabase/client";
import { cached, rpcData } from "@/lib/client-cache";
import { compact, price } from "@/lib/format";
import type { Mover } from "@/lib/data";

const INDEXES = [
  { id: "ALL", label: "Semua" }, { id: "IDX30", label: "IDX30" }, { id: "LQ45", label: "LQ45" },
  { id: "IDX80", label: "IDX80" }, { id: "SRI-KEHATI", label: "Kehati" }, { id: "IDXHIDIV20", label: "High Div" },
];

const toMover = (r: Record<string, unknown>): Mover => ({
  stock_code: r.stock_code as string, name: r.name as string, sector: (r.sector as string) ?? null, close: Number(r.close),
  change_pct: r.change_pct === null ? null : Number(r.change_pct), value: Number(r.value), volume: 0, net_foreign: null,
  trade_date: r.trade_date as string, spark: r.spark ? (r.spark as unknown[]).map(Number) : null,
});

export default function StockExplorer({ initial, initialQuery = "" }: { initial: Mover[]; initialQuery?: string }) {
  const signedIn = useSignedIn();
  const [index, setIndex] = useState("ALL");
  const [q, setQ] = useState(initialQuery);
  const [rows, setRows] = useState<Mover[]>(initial);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (after: string | null, reset: boolean) => {
    setLoading(true); setErr(null);
    let data: Record<string, unknown>[];
    try {
      data = await cached(`stocks:${index}:${q.trim().toLowerCase()}:${after ?? ""}`, () => rpcData<Record<string, unknown>[]>(
        createClient().rpc("stock_table", { p_index: index, p_q: q.trim() || null, p_limit: 25, p_after: after })), 2 * 60_000);
    } catch { setLoading(false); setErr("Gagal memuat data. Coba lagi."); return; }
    setLoading(false);
    const list = (data ?? []).map(toMover);
    setRows((prev) => (reset ? list : [...prev, ...list]));
    setMore(list.length === 25);
  }, [index, q]);

  useEffect(() => {
    if (!signedIn) return;
    const t = setTimeout(() => load(null, true), 250);
    return () => clearTimeout(t);
  }, [signedIn, load]);

  const csvHref = `/api/csv/stocks?index=${index}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="cari-saham">Cari saham</label>
        <input id="cari-saham" type="search" enterKeyHint="search" autoComplete="off" spellCheck={false} className="input max-w-xs" placeholder="Cari kode atau nama" value={q} onChange={(e) => setQ(e.target.value)} disabled={signedIn === false} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter indeks">
          {INDEXES.map((i) => <button key={i.id} className="chip" aria-pressed={index === i.id} disabled={signedIn === false} onClick={() => setIndex(i.id)}>{i.label}</button>)}
        </div>
        {signedIn && <a className="btn ms-auto" href={csvHref} download><Download size={16} aria-hidden="true" /> Unduh CSV</a>}
      </div>

      <div className="mt-4 table-scroll">
        <table className="data" aria-busy={loading}>
          <thead><tr><th>Kode</th><th className="hidden sm:table-cell">Nama</th><th className="r">Harga</th><th className="r">Perubahan</th><th className="r hidden md:table-cell">Nilai</th><th className="r hidden md:table-cell"><span className="sr-only">Tren</span></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.stock_code}>
                <td><Link className="font-medium text-brand" href={`/saham/${r.stock_code}`}>{r.stock_code}</Link></td>
                <td className="hidden max-w-[260px] truncate sm:table-cell">{r.name}</td>
                <td className="r">{price(r.close)}</td>
                <td className="r"><Delta value={r.change_pct} /></td>
                <td className="r hidden md:table-cell">{compact(r.value)}</td>
                <td className="r hidden md:table-cell"><Sparkline data={r.spark} width={64} height={22} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && rows.length === 0 && <div className="space-y-2 pt-2" role="status" aria-label="Memuat daftar saham">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
        {!loading && !err && rows.length === 0 && signedIn !== false && (
          <div className="mt-3"><Empty title="Tidak ada hasil" message={q.trim() ? `Tidak ada saham dengan kode atau nama "${q.trim()}". Periksa ejaan atau coba kata lain.` : "Tidak ada saham pada filter ini."}
            action={q.trim() ? <button type="button" className="btn" onClick={() => setQ("")}>Hapus pencarian</button> : undefined} /></div>
        )}
      </div>
      {err && <p role="alert" className="mt-2 flex flex-wrap items-center gap-2 down">{err} <button type="button" className="btn btn-sm" onClick={() => load(null, true)}>Coba lagi</button></p>}
      {signedIn && more && !loading && <div className="mt-4 text-center"><button className="btn" onClick={() => load(rows[rows.length - 1]?.stock_code ?? null, false)}>Muat 25 saham berikutnya</button></div>}
      {signedIn === false && <div className="mt-4"><Locked text="Daftar gratis untuk melihat seluruh saham, mencari, memfilter per indeks, dan mengunduh CSV." href="/daftar" cta="Daftar gratis" /></div>}
    </div>
  );
}
