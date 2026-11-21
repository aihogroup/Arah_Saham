import Link from "next/link";
import { Suspense } from "react";
import StockExplorer from "@/components/StockExplorer";
import StockGroupGrid, { type GroupKind } from "@/components/StockGroupGrid";
import { T } from "@/components/T";
import { PageHead, Skeleton, Stamp } from "@/components/ui";
import { getDataStatus, getStockGroups, getStockList } from "@/lib/data";
import type { Key } from "@/lib/i18n";

export const metadata = { title: "Daftar saham", description: "Daftar saham IDX menurut sektor, papan pencatatan, dan indeks, dengan harga, perubahan, dan nilai transaksi." };

const TABS: { id: "semua" | GroupKind; k: Key }[] = [
  { id: "semua", k: "stocks.tab.all" }, { id: "sektor", k: "stocks.tab.sektor" }, { id: "papan", k: "stocks.tab.papan" }, { id: "indeks", k: "stocks.tab.indeks" },
];

async function Body({ sp }: { sp: Promise<{ q?: string; lihat?: string }> }) {
  const { q, lihat } = await sp;
  const tab = TABS.find((t) => t.id === lihat)?.id ?? "semua";
  const st = await getDataStatus();
  return (
    <>
      <Stamp date={st?.stock_date} demo={st?.demo} />
      <nav aria-label="Kelompok saham" className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => <Link key={t.id} href={t.id === "semua" ? "/saham" : `/saham?lihat=${t.id}`} className="chip" data-active={tab === t.id} aria-current={tab === t.id ? "page" : undefined}><T k={t.k} /></Link>)}
      </nav>
      <div className="mt-6">
        {tab === "semua" ? <AllStocks q={q ?? ""} /> : <Groups kind={tab} />}
      </div>
    </>
  );
}

async function AllStocks({ q }: { q: string }) {
  const initial = await getStockList(null, 10);
  return <StockExplorer initial={initial} initialQuery={q} />;
}

async function Groups({ kind }: { kind: GroupKind }) {
  const groups = await getStockGroups(kind);
  return <StockGroupGrid kind={kind} groups={groups} />;
}

export default function SahamPage({ searchParams }: { searchParams: Promise<{ q?: string; lihat?: string }> }) {
  return (
    <div className="container-x py-10">
      <PageHead title={<T k="stocks.title" />} lead={<T k="stocks.lead" />} />
      <Suspense fallback={<Skeleton className="h-96" />}><Body sp={searchParams} /></Suspense>
    </div>
  );
}
