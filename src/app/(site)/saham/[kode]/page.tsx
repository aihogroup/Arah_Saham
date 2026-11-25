import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import MarketChart from "@/components/MarketChart";
import GuestOnly from "@/components/GuestOnly";
import Seasonality from "@/components/Seasonality";
import StockInsight from "@/components/StockInsight";
import { Disclaimer, Locked, PageHead, Skeleton } from "@/components/ui";
import { getStock, getStockCodes } from "@/lib/data";
import { compact, dateId, int } from "@/lib/format";

export async function generateStaticParams() {
  const codes = await getStockCodes(20);
  return codes.length ? codes.map((kode) => ({ kode })) : [{ kode: "BBCA" }];
}

export async function generateMetadata({ params }: { params: Promise<{ kode: string }> }): Promise<Metadata> {
  const { kode } = await params;
  const d = await getStock(kode);
  if (!d.stock) return { title: "Saham tidak ditemukan" };
  return { title: `${d.stock.code} · ${d.stock.name}`, description: `Harga, perubahan, dan riwayat indeks ${d.stock.name} (${d.stock.code}).` };
}

async function Detail({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const d = await getStock(kode);
  if (!d.stock) notFound();
  const last = d.series[d.series.length - 1];
  return (
    <>
      <PageHead title={`${d.stock.code} · ${d.stock.name}`} lead={[d.stock.sector, d.stock.board && `Papan ${d.stock.board}`].filter(Boolean).join(" · ")} />
      <div className="card">
<div><MarketChart symbol={`${d.stock.code}.JK`} height={380} defaultRange="1y" label={`Grafik harga ${d.stock.code}`} fallback={d.series.map((r) => ({ time: r.trade_date, value: r.close }))} /></div>
        <details className="mt-3"><summary className="cursor-pointer text-sm text-brand">Pola musiman</summary><Seasonality source="stock" symbol={d.stock.code} /></details>
      </div>
      <div className="mt-6"><StockInsight code={d.stock.code} /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3>Ringkasan</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-body">
            <dt className="text-muted">Nilai transaksi</dt><dd className="text-end">{compact(last?.value)}</dd>
            <dt className="text-muted">Volume</dt><dd className="text-end">{int(last?.volume)}</dd>
            <dt className="text-muted">Saham tercatat</dt><dd className="text-end">{compact(d.stock.listed_shares)}</dd>
            <dt className="text-muted">Anggota indeks</dt><dd className="text-end">{d.indexes.length ? d.indexes.join(", ") : "–"}</dd>
          </dl>
        </div>
        <div className="card">
          <h3>Riwayat masuk dan keluar indeks</h3>
          {d.changes.length === 0 ? <p className="mt-3 text-muted">Belum ada perubahan tercatat.</p> : (
            <ul className="mt-3 divide-y divide-line">
              {d.changes.map((c, i) => (
                <li key={i} className="flex min-h-[44px] items-center justify-between gap-3">
                  <span>{c.index_code} · {dateId(c.effective_date)}</span>
                  <span className={c.change_type === "in" ? "up font-medium" : "down font-medium"}>{c.change_type === "in" ? "▲ Masuk" : "▼ Keluar"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <GuestOnly><div className="mt-6"><Locked text="Riwayat harga penuh dan aktivitas broker tersedia untuk akun gratis. Skor dan kesimpulan analisis ada di Analisis Saya (premium)." href="/daftar" cta="Daftar gratis" /></div></GuestOnly>
      <Disclaimer className="mt-6" />
    </>
  );
}

export default function StockPage({ params }: { params: Promise<{ kode: string }> }) {
  return <div className="container-x py-6 sm:py-8"><Suspense fallback={<Skeleton className="h-96" />}><Detail params={params} /></Suspense></div>;
}
