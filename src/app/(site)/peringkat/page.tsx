import { Suspense } from "react";
import RankingTabs from "@/components/RankingTabs";
import { PageHead, Skeleton, Stamp } from "@/components/ui";
import { getDataStatus, getRankStocks } from "@/lib/data";
import { BOARDS, INDEXES, SECTORS } from "@/lib/nav";
import { parseMetric } from "@/lib/ranking";

export const metadata = {
  title: "Peringkat saham",
  description: "Peringkat saham IDX berdasarkan gainer, loser, value, volume, frekuensi, transaksi asing, dan free float, untuk satu hari atau rentang tanggal.",
};
type SP = { jenis?: string; papan?: string; sektor?: string; indeks?: string; dari?: string; sampai?: string };
const pick = (v: string | undefined, ok: readonly string[]) => (v && ok.includes(v) ? v : "");
const date = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

async function Content({ sp }: { sp: Promise<SP> }) {
  const q = await sp;
  const filter = {
    metric: parseMetric(q.jenis), board: pick(q.papan, BOARDS), sector: pick(q.sektor, SECTORS), index: pick(q.indeks, INDEXES.map(([c]) => c)),
    from: date(q.dari), to: date(q.sampai),
  };
  // Server selalu menyajikan hari terakhir (aman di-cache); rentang tanggal dimuat dari klien oleh akun yang masuk.
  const [rows, st] = await Promise.all([getRankStocks(filter.metric, filter.board || null, filter.sector || null, filter.index || null, 10), getDataStatus()]);
  const latest = st?.stock_date ?? rows[0]?.to_date ?? new Date().toISOString().slice(0, 10);
  return (
    <>
      <Stamp date={st?.stock_date} demo={st?.demo} />
      <div className="mt-6"><RankingTabs initial={rows} initialFilter={{ ...filter, from: "", to: "" }} latest={latest} dates={{ from: filter.from, to: filter.to }} /></div>
    </>
  );
}

export default function PeringkatPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <div className="container-x py-6 sm:py-8">
      <PageHead title="Peringkat saham" lead="Pilih metrik, periode, dan kelompok saham. Pengunjung melihat 10 teratas hari bursa terakhir; akun gratis dapat memilih tanggal atau rentang waktu." />
      <Suspense fallback={<Skeleton className="h-96" />}><Content sp={searchParams} /></Suspense>
    </div>
  );
}
