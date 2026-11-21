"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Delta, Sparkline } from "@/components/ui";
import { useSignedIn } from "@/components/useSignedIn";
import { createClient } from "@/lib/supabase/client";
import { cached, rpcData } from "@/lib/client-cache";
import { compact, price } from "@/lib/format";
import type { Mover } from "@/lib/data";

const KINDS = [
  { id: "gainer", label: "Top Gainer" }, { id: "loser", label: "Top Loser" },
  { id: "value", label: "Top Value" }, { id: "net_foreign", label: "Net Asing" },
] as const;
type Kind = (typeof KINDS)[number]["id"];

export default function RankingTabs({ initial, initialKind }: { initial: Mover[]; initialKind: Kind }) {
  const signedIn = useSignedIn();
  const [kind, setKind] = useState<Kind>(initialKind);
  const [rows, setRows] = useState<Mover[]>(initial);
  const [limit, setLimit] = useState(10);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (kind === initialKind && limit === 10) { setRows(initial); return; }
    let live = true;
    setLoading(true);
    cached(`rank:${kind}:${limit}`, () => rpcData<Record<string, unknown>[]>(createClient().rpc("rankings", { p_kind: kind, p_limit: limit })))
      .then((data) => {
      if (!live) return;
      setLoading(false);
      setErr(null);
      setRows((data ?? []).map((r) => ({
        stock_code: r.stock_code as string, name: r.name as string, sector: (r.sector as string) ?? null, close: Number(r.close),
        change_pct: r.change_pct === null ? null : Number(r.change_pct), value: Number(r.value), volume: Number(r.volume),
        net_foreign: r.net_foreign === null ? null : Number(r.net_foreign), trade_date: r.trade_date as string,
        spark: r.spark ? (r.spark as unknown[]).map(Number) : null,
      })));
      })
      .catch(() => { if (live) { setLoading(false); setErr("Gagal memuat peringkat."); } });
    return () => { live = false; };
  }, [kind, limit, initial, initialKind]);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Jenis peringkat">
        {KINDS.map((k) => <button key={k.id} className="chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>)}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="data">
          <thead><tr><th>#</th><th>Kode</th><th className="hidden sm:table-cell">Nama</th><th className="r">Harga</th><th className="r">{kind === "net_foreign" ? "Net asing" : "Perubahan"}</th><th className="r hidden md:table-cell">Nilai</th><th className="r hidden md:table-cell"><span className="sr-only">Tren</span></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.stock_code}>
                <td className="text-muted">{i + 1}</td>
                <td><Link href={`/saham/${r.stock_code}`} className="font-medium text-brand">{r.stock_code}</Link></td>
                <td className="hidden max-w-[240px] truncate sm:table-cell">{r.name}</td>
                <td className="r">{price(r.close)}</td>
                <td className="r">{kind === "net_foreign" ? <span className={(r.net_foreign ?? 0) >= 0 ? "up" : "down"}>{(r.net_foreign ?? 0) >= 0 ? "▲ +" : "▼ −"}{compact(Math.abs(r.net_foreign ?? 0))}</span> : <Delta value={r.change_pct} />}</td>
                <td className="r hidden md:table-cell">{compact(r.value)}</td>
                <td className="r hidden md:table-cell"><Sparkline data={r.spark} width={64} height={22} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="py-4 text-center text-muted" role="status">Memuat…</p>}
      </div>
      {err && <p role="alert" className="mt-2 down">{err}</p>}
      {signedIn && limit < 100 && <div className="mt-4 text-center"><button className="btn" onClick={() => setLimit(100)}>Lihat 100 teratas</button></div>}
    </div>
  );
}
