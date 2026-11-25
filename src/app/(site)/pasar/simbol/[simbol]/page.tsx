import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import SymbolHistory from "@/components/SymbolHistory";
import { T } from "@/components/T";
import { Delta, Skeleton, Stamp } from "@/components/ui";
import { getMarketCatalog, getMarketSeries } from "@/lib/data";
import { dateId } from "@/lib/format";
import { catByDb, mprice } from "@/lib/market";

const INITIAL_DAYS = 365;
const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export async function generateStaticParams() {
  const rows = await getMarketCatalog();
  return rows.length ? rows.map((r) => ({ simbol: r.symbol })) : [{ simbol: "GC=F" }];
}

export async function generateMetadata({ params }: { params: Promise<{ simbol: string }> }): Promise<Metadata> {
  const sym = decode((await params).simbol);
  const row = (await getMarketCatalog()).find((r) => r.symbol === sym);
  return { title: row ? `${row.name} (${row.symbol}) · Pasar` : "Instrumen tidak ditemukan", description: row ? `Riwayat harga ${row.name} sejak ${row.first_date ?? ""}.` : undefined };
}

async function Content({ params }: { params: Promise<{ simbol: string }> }) {
  const sym = decode((await params).simbol);
  const row = (await getMarketCatalog()).find((r) => r.symbol === sym);
  if (!row) notFound();
  const cat = catByDb(row.category);
  const initial = await getMarketSeries(row.symbol, INITIAL_DAYS);
  const perf: { k: "col.d1" | "col.w1" | "col.m1" | "col.m3" | "col.ytd" | "col.y1"; v: number | null }[] = [
    { k: "col.d1", v: row.change_pct }, { k: "col.w1", v: row.chg_1w }, { k: "col.m1", v: row.chg_1m }, { k: "col.m3", v: row.chg_3m }, { k: "col.ytd", v: row.chg_ytd }, { k: "col.y1", v: row.chg_1y },
  ];
  return (
    <>
      <nav aria-label="Jalur halaman" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/pasar" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft size={16} aria-hidden="true" /> <T k="market.back" /></Link>
        {cat && <><span aria-hidden="true">/</span><Link href={`/pasar/${cat.slug}`} className="hover:text-foreground"><T k={cat.k} /></Link></>}
      </nav>
      <p className="text-meta text-muted">{row.symbol}</p>
      <h1>{row.name}</h1>
      <div className="mt-2 flex flex-wrap items-baseline gap-3"><span className="text-display font-semibold">{mprice(row.close)}</span><Delta value={row.change_pct} /></div>
      <Stamp date={row.last_date} />
      <div className="card mt-6">
        <h2 className="text-lg leading-7"><T k="market.perf" /></h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {perf.map((p) => <div key={p.k}><dt className="text-meta text-muted"><T k={p.k} /></dt><dd className="mt-1"><Delta value={p.v} digits={1} /></dd></div>)}
        </dl>
        <p className="mt-3 text-meta text-muted"><T k="market.since" /> {dateId(row.first_date)} · {row.n_days.toLocaleString("id-ID")} <T k="market.days" /></p>
      </div>
      <div className="mt-6"><SymbolHistory symbol={row.symbol} name={row.name} initial={initial} initialDays={INITIAL_DAYS} /></div>
    </>
  );
}

export default function SimbolPage({ params }: { params: Promise<{ simbol: string }> }) {
  return <div className="container-x py-6 sm:py-8"><Suspense fallback={<Skeleton className="h-96" />}><Content params={params} /></Suspense></div>;
}
