"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Empty, Locked, Skeleton } from "@/components/ui";
import { useSignedIn } from "@/components/useSignedIn";
import { createClient } from "@/lib/supabase/client";
import { cached, rpcData } from "@/lib/client-cache";
import { compact, dateId, int } from "@/lib/format";

type Row = { broker_code: string; name: string; value: number; volume: number; frequency: number; share: number; trade_date: string };

export default function BrokerTable() {
  const signedIn = useSignedIn();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    cached("broker:200", () => rpcData<Row[]>(createClient().rpc("broker_share", { p_limit: 200 })), 10 * 60_000)
      .then((data) => setRows((data ?? []).map((r) => ({ ...r, value: Number(r.value ?? 0), volume: Number(r.volume ?? 0), frequency: Number(r.frequency ?? 0) }))))
      .catch(() => setErr("Gagal memuat data broker."));
  }, [signedIn]);

  if (signedIn === false) return <Locked text="Data broker (nilai, volume, frekuensi, pangsa) tersedia untuk akun gratis." href="/daftar" cta="Daftar gratis" />;
  if (err) return <p role="alert" className="down">{err}</p>;
  if (!rows) return <Skeleton className="h-96" />;
  if (rows.length === 0) return <Empty message="Data broker belum tersedia." />;
  const list = rows.filter((r) => !q || r.broker_code.toLowerCase().includes(q.toLowerCase()) || r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="cari-broker">Cari broker</label>
        <input id="cari-broker" className="input max-w-xs" placeholder="Cari broker" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="text-meta text-muted">Data per {dateId(rows[0].trade_date)}</p>
        <a className="btn ms-auto" href="/api/csv/brokers" download><Download size={16} aria-hidden="true" /> Unduh CSV</a>
      </div>
      <div className="mt-4 table-scroll">
        <table className="data">
          <thead><tr><th>Broker</th><th className="hidden sm:table-cell">Nama</th><th className="r">Nilai</th><th className="r hidden md:table-cell">Volume</th><th className="r hidden md:table-cell">Frekuensi</th><th className="r">Pangsa nilai</th></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.broker_code}>
              <td className="font-medium">{r.broker_code}</td><td className="hidden sm:table-cell">{r.name}</td>
              <td className="r">{compact(r.value)}</td><td className="r hidden md:table-cell">{compact(r.volume)}</td><td className="r hidden md:table-cell">{int(r.frequency)}</td>
              <td className="r">{(r.share * 100).toFixed(2).replace(".", ",")}%</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
