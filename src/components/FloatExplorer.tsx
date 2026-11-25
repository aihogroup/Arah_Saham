"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PumpBadge } from "@/components/StockInsight";
import { Empty, Skeleton } from "@/components/ui";
import { cached, rpcData } from "@/lib/client-cache";
import { compact, price } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Row = { stock_code: string; name: string; sector: string | null; close: number; free_float_pct: number | null; float_known: boolean; float_mcap: number | null; avg_value_20d: number | null; turnover_float: number | null; vol20: number | null; pump_score: number; risk_label: string };

const SORTS = [["score", "Risiko tertinggi"], ["ff_asc", "Free float terkecil"], ["ff_desc", "Free float terbesar"], ["value", "Transaksi terbesar"]] as const;
const LABELS = [["", "Semua tingkat"], ["tinggi", "Rawan digoreng"], ["sedang", "Waspada sedang"], ["rendah", "Relatif sulit digoreng"]] as const;

export default function FloatExplorer() {
  const [sort, setSort] = useState<string>("score");
  const [label, setLabel] = useState("");
  const [known, setKnown] = useState(true);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    setRows(null); setErr(false);
    cached(`float:${sort}:${label}:${known}`, () => rpcData<Row[]>(createClient().rpc("stock_float_list", { p_sort: sort, p_limit: 300, p_label: label || null, p_only_known: known })), 5 * 60_000)
      .then((r) => { if (live) setRows(r ?? []); }).catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [sort, label, known]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Urutkan
          <select className="input mt-1 block" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </label>
        <label className="text-sm">Tingkat risiko
          <select className="input mt-1 block" value={label} onChange={(e) => setLabel(e.target.value)}>{LABELS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-[var(--brand)]" checked={known} onChange={(e) => setKnown(e.target.checked)} /> Hanya yang free float-nya tercatat</label>
      </div>
      {err ? <p role="alert" className="down">Data belum dapat dimuat. Coba lagi nanti.</p> : rows === null ? <Skeleton className="h-96" /> : rows.length === 0 ? <Empty message="Tidak ada saham yang sesuai." /> : (
        <div className="card table-scroll p-0">
          <table className="w-full min-w-[760px] text-start text-sm">
            <thead className="text-muted"><tr className="border-b border-line">
              <th className="p-3 font-medium">Saham</th><th className="p-3 text-end font-medium">Harga</th><th className="p-3 text-end font-medium">Free float</th>
              <th className="p-3 text-end font-medium">Kap. float</th><th className="p-3 text-end font-medium">Transaksi 20h</th><th className="p-3 text-end font-medium">Perputaran/hari</th><th className="p-3 font-medium">Risiko</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.stock_code} className="border-b border-line last:border-0">
                  <td className="p-3"><Link href={`/saham/${r.stock_code}`} className="font-semibold hover:underline">{r.stock_code}</Link><div className="max-w-[220px] truncate text-caption text-muted">{r.name}</div></td>
                  <td className="p-3 text-end">{price(r.close)}</td>
                  <td className="p-3 text-end">{r.float_known && r.free_float_pct !== null ? `${Number(r.free_float_pct).toFixed(1).replace(".", ",")}%` : "–"}</td>
                  <td className="p-3 text-end">{compact(r.float_mcap)}</td>
                  <td className="p-3 text-end">{compact(r.avg_value_20d)}</td>
                  <td className="p-3 text-end">{r.turnover_float === null ? "–" : (r.turnover_float * 100).toFixed(2).replace(".", ",") + "%"}</td>
                  <td className="p-3"><PumpBadge label={r.risk_label} score={r.pump_score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
