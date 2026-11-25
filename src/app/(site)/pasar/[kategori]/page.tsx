import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import MarketTable from "@/components/MarketTable";
import { T } from "@/components/T";
import { PageHead, Skeleton, Stamp } from "@/components/ui";
import { getMarketCatalog } from "@/lib/data";
import { MARKET_CATS, catBySlug } from "@/lib/market";

export function generateStaticParams() {
  return MARKET_CATS.map((c) => ({ kategori: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ kategori: string }> }): Promise<Metadata> {
  const c = catBySlug((await params).kategori);
  return c ? { title: `${c.title} · Pasar` } : { title: "Kategori tidak ditemukan" };
}

async function Content({ params }: { params: Promise<{ kategori: string }> }) {
  const c = catBySlug((await params).kategori);
  if (!c) notFound();
  const rows = (await getMarketCatalog()).filter((x) => (c.dbs as readonly string[]).includes(x.category));
  return (
    <>
      <PageHead title={<T k={c.k} />} lead={<T k={c.lead} />} />
      <Stamp date={rows[0]?.last_date} />
      <div className="card mt-6"><MarketTable rows={rows} full /></div>
    </>
  );
}

export default function KategoriPage({ params }: { params: Promise<{ kategori: string }> }) {
  return (
    <div className="container-x py-6 sm:py-8">
      <Link href="/pasar" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"><ArrowLeft size={16} aria-hidden="true" /> <T k="market.back" /></Link>
      <Suspense fallback={<Skeleton className="h-96" />}><Content params={params} /></Suspense>
    </div>
  );
}
