"use client";

import { type Point } from "@/components/Chart";
import MarketChart from "@/components/MarketChart";
import Seasonality from "@/components/Seasonality";
import { Delta } from "@/components/ui";
import { num } from "@/lib/format";

/** Grafik IHSG langsung dari Yahoo Finance (^JKSE). Data database dipakai sebagai cadangan dan pada seasonality. */
export default function IhsgPanel({ initial, lastClose, lastChange }: { initial: Point[]; lastClose: number | null; lastChange: number | null }) {
  return (
    <div className="card">
      <p className="text-meta text-muted">IHSG · penutupan terakhir di database {num(lastClose)} (<Delta value={lastChange} />)</p>
      <div className="mt-2"><MarketChart symbol="^JKSE" label="Grafik IHSG" defaultRange="1mo" gateLong fallback={initial} /></div>
      <details className="mt-3"><summary className="cursor-pointer text-sm text-brand">Pola musiman</summary><Seasonality source="index" symbol="COMPOSITE" /></details>
    </div>
  );
}
