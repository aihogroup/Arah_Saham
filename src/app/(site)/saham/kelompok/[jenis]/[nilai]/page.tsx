import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import GroupStocks from "@/components/GroupStocks";
import { T } from "@/components/T";
import { Delta, PageHead, Skeleton } from "@/components/ui";
import { getGroupStocksPublic, getStockGroups } from "@/lib/data";
import { compact, int } from "@/lib/format";

const KINDS = ["sektor", "papan", "indeks"] as const;
type Kind = (typeof KINDS)[number];
const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export async function generateStaticParams() {
  const all = await Promise.all(KINDS.map(async (k) => (await getStockGroups(k)).map((g) => ({ jenis: k, nilai: g.grp }))));
  const flat = all.flat();
  return flat.length ? flat : [{ jenis: "papan", nilai: "Utama" }];
}

export async function generateMetadata({ params }: { params: Promise<{ jenis: string; nilai: string }> }): Promise<Metadata> {
  const { jenis, nilai } = await params;
  return { title: `${decode(nilai)} · Saham` , description: `Daftar saham pada ${jenis} ${decode(nilai)}.` };
}

async function Content({ params }: { params: Promise<{ jenis: string; nilai: string }> }) {
  const p = await params;
  const kind = KINDS.find((k) => k === p.jenis) as Kind | undefined;
  if (!kind) notFound();
  const value = decode(p.nilai);
  const group = (await getStockGroups(kind)).find((g) => g.grp === value);
  if (!group) notFound();
  const initial = await getGroupStocksPublic(kind, value);
  return (
    <>
      <p className="text-meta text-muted"><T k={`stocks.group.${kind}`} /></p>
      <PageHead title={group.grp === "-" ? <T k="stocks.unclassified" /> : group.label} lead={group.n ? <>{int(group.n)} <T k="stocks.members" /> · <T k="market.value" /> {compact(group.total_value)} · <Delta value={group.avg_change} /></> : <T k="stocks.noIndexData" />} />
      <div className="card"><GroupStocks kind={kind} value={value} initial={initial} /></div>
    </>
  );
}

export default function KelompokPage({ params }: { params: Promise<{ jenis: string; nilai: string }> }) {
  return (
    <div className="container-x py-6 sm:py-8">
      <Link href="/saham" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"><ArrowLeft size={16} aria-hidden="true" /> <T k="stocks.back" /></Link>
      <Suspense fallback={<Skeleton className="h-96" />}><Content params={params} /></Suspense>
    </div>
  );
}
