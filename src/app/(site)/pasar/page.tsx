import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import IhsgPanel from "@/components/IhsgPanel";
import MarketTable from "@/components/MarketTable";
import { T } from "@/components/T";
import PageSkeleton from "@/components/PageSkeleton";
import { PageHead, Stamp, StatCard } from "@/components/ui";
import { getDataStatus, getIhsgSeries, getMarketCatalog, getOverview } from "@/lib/data";
import { compact, int, num } from "@/lib/format";
import { MARKET_CATS } from "@/lib/market";

export const metadata = { title: "Pasar", description: "IHSG, breadth pasar, komoditas, kurs, indeks global, dan proksi Indonesia, lengkap dengan riwayat per instrumen." };

async function Content() {
  const [o, series, st, catalog] = await Promise.all([getOverview(), getIhsgSeries(31), getDataStatus(), getMarketCatalog()]);
  const b = o?.breadth;
  return (
    <>
      <Stamp date={st?.index_date} demo={st?.demo} />
      {st && !st.complete && <p role="status" className="mt-3 rounded-lg bg-[var(--warn-bg)] p-3 text-sm text-[var(--warn-fg)]"><T k="market.incomplete" /></p>}
      <div className="mt-6"><IhsgPanel initial={series.map((r) => ({ time: r.trade_date, value: r.close }))} lastClose={o?.ihsg?.close ?? null} lastChange={o?.ihsg?.change_pct ?? null} /></div>
      {/* Tiga angka ringkas (Hukum Miller: sedikit potongan informasi yang mudah diingat). */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-6">
        <StatCard label={<T k="market.breadth" />} value={b ? `${int(b.advancers)} / ${int(b.decliners)}` : "–"} note={<T k="market.advDec" />} valueClass="text-display" />
        <StatCard label={<T k="market.aboveMa" />} value={b?.pct_above_ma20 != null ? `${num(b.pct_above_ma20 * 100, 0)}%` : "–"} note={<T k="market.ofAll" />} valueClass="text-display" />
        <StatCard label={<T k="market.value" />} value={compact(b?.total_value)} note={<T k="market.valueSub" />} valueClass="text-display" />
      </div>
      <div className="mt-6 space-y-6">
        {MARKET_CATS.map((c) => {
          const rows = catalog.filter((x) => (c.dbs as readonly string[]).includes(x.category));
          if (!rows.length) return null;
          return (
            <section key={c.slug} className="card" aria-labelledby={`h-${c.slug}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h2 id={`h-${c.slug}`} className="text-2xl leading-8"><Link href={`/pasar/${c.slug}`} className="hover:underline"><T k={c.k} /></Link></h2>
                  <p className="text-sm text-muted"><T k={c.lead} /></p></div>
                <Link href={`/pasar/${c.slug}`} className="btn btn-ghost -me-3 text-brand"><T k="market.viewAll" /> ({rows.length}) <ChevronRight size={16} aria-hidden="true" /></Link>
              </div>
              <div className="mt-3"><MarketTable rows={rows} /></div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export default function PasarPage() {
  return (
    <div className="container-x py-6 sm:py-8">
      <PageHead title={<T k="market.title" />} lead={<T k="market.lead" />} />
      <Suspense fallback={<PageSkeleton />}><Content /></Suspense>
    </div>
  );
}
