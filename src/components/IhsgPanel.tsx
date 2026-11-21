"use client";

import { useEffect, useState } from "react";
import Chart, { type Point } from "@/components/Chart";
import Seasonality from "@/components/Seasonality";
import { Delta, Locked } from "@/components/ui";
import { useSignedIn } from "@/components/useSignedIn";
import { createClient } from "@/lib/supabase/client";
import { cached, rpcPaged } from "@/lib/client-cache";
import { num } from "@/lib/format";

const PERIODS = [
  { label: "1 bulan", days: 21 },
  { label: "3 bulan", days: 63 },
  { label: "1 tahun", days: 252 },
  { label: "5 tahun", days: 1260 },
];

export default function IhsgPanel({ initial, lastClose, lastChange }: { initial: Point[]; lastClose: number | null; lastChange: number | null }) {
  const signedIn = useSignedIn();
  const [days, setDays] = useState(21);
  const [data, setData] = useState<Point[]>(initial);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn || days <= 21) { setData(days <= 21 ? initial.slice(-days) : initial); return; }
    let live = true;
    cached(`ihsg:${days}`, () => rpcPaged<{ trade_date: string; close: number | string }>((a, b) => createClient().rpc("ihsg_series", { p_days: days }).range(a, b)))
      .then((rows) => {
        if (!live) return;
        setErr(null);
        setData((rows ?? []).filter((r) => r.close !== null).map((r) => ({ time: r.trade_date, value: Number(r.close) })));
      })
      .catch(() => { if (live) setErr("Gagal memuat grafik. Coba lagi."); });
    return () => { live = false; };
  }, [days, signedIn, initial]);

  return (
    <div className="card">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">IHSG</p>
          <p className="text-[32px] font-semibold leading-10">{num(lastClose)}</p>
          <Delta value={lastChange} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Periode grafik">
          {PERIODS.map((p) => (
            <button key={p.days} className="chip" aria-pressed={days === p.days} disabled={p.days > 21 && !signedIn} onClick={() => setDays(p.days)} title={p.days > 21 && !signedIn ? "Masuk untuk riwayat lebih panjang" : undefined}>{p.label}</button>
          ))}
        </div>
      </div>
      <div className="mt-4">{data.length ? <Chart data={data} label={`Grafik IHSG ${days} hari`} /> : <p className="py-16 text-center text-muted">Data grafik belum tersedia.</p>}</div>
      {err && <p role="alert" className="mt-2 text-[14px] down">{err}</p>}
      {signedIn === false && <div className="mt-4"><Locked text="Riwayat penuh IHSG (hingga 5 tahun) tersedia untuk akun gratis." href="/daftar" cta="Daftar gratis" /></div>}
      <Seasonality source="index" symbol="COMPOSITE" />
    </div>
  );
}
