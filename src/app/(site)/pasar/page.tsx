import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import IhsgPanel from "@/components/IhsgPanel";
import MarketTable from "@/components/MarketTable";
import { T } from "@/components/T";
import { PageHead, Skeleton, Stamp } from "@/components/ui";
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
      {st && !st.complete && <p role="status" className="mt-3 rounded-lg bg-[var(--warn-bg)] p-3 text-[14px] text-[var(--warn-fg)]"><T k="market.incomplete" /></p>}
      <div className="mt-6"><IhsgPanel initial={series.map((r) => ({ time: r.trade_date, value: r.close }))} lastClose={o?.ihsg?.close ?? null} lastChange={o?.ihsg?.change_pct ?? null} /></div>
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="card"><p className="text-[13px] text-muted"><T k="market.breadth" /></p><p className="mt-1 text-[28px] font-semibold leading-9">{b ? `${int(b.advancers)} / ${int(b.decliners)}` : "–"}</p><p className="text-[13px] text-muted"><T k="market.advDec" /></p></div>
        <div className="card"><p className="text-[13px] text-muted"><T k="market.aboveMa" /></p><p className="mt-1 text-[28px] font-semibold leading-9">{b?.pct_above_ma20 != null ? `${num(b.pct_above_ma20 * 100, 0)}%` : "–"}</p><p className="text-[13px] text-muted"><T k="market.ofAll" /></p></div>
        <div className="card"><p className="text-[13px] text-muted"><T k="market.value" /></p><p className="mt-1 text-[28px] font-semibold leading-9">{compact(b?.total_value)}</p><p className="text-[13px] text-muted"><T k="market.valueSub" /></p></div>
      </div>
      <div className="mt-6 space-y-6">
        {MARKET_CATS.map((c) => {
          const rows = catalog.filter((x) => x.category === c.db);
          if (!rows.length) return null;
          return (
            <section key={c.slug} className="card" aria-labelledby={`h-${c.slug}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h2 id={`h-${c.slug}`} className="text-[22px] leading-8"><Link href={`/pasar/${c.slug}`} className="hover:underline"><T k={c.k} /></Link></h2>
                  <p className="text-[14px] text-muted"><T k={c.lead} /></p></div>
                <Link href={`/pasar/${c.slug}`} className="btn btn-ghost -mr-3 text-brand"><T k="market.viewAll" /> ({rows.length}) <ChevronRight size={16} aria-hidden="true" /></Link>
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
    <div className="container-x py-10">
      <PageHead title={<T k="market.title" />} lead={<T k="market.lead" />} />
      <Suspense fallback={<Skeleton className="h-96" />}><Content /></Suspense>
    </div>
  );
}
