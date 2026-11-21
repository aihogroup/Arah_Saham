import { Suspense } from "react";
import RankingTabs from "@/components/RankingTabs";
import GuestOnly from "@/components/GuestOnly";
import { Locked, PageHead, Skeleton, Stamp } from "@/components/ui";
import { getDataStatus, getRanking } from "@/lib/data";

export const metadata = { title: "Peringkat saham", description: "Top gainer, top loser, top value, dan net asing hari bursa terakhir." };
const KINDS = ["gainer", "loser", "value", "net_foreign"] as const;

async function Content({ sp }: { sp: Promise<{ jenis?: string }> }) {
  const { jenis } = await sp;
  const kind = (KINDS as readonly string[]).includes(jenis ?? "") ? (jenis as (typeof KINDS)[number]) : "gainer";
  const [rows, st] = await Promise.all([getRanking(kind, 10), getDataStatus()]);
  return (
    <>
      <Stamp date={st?.stock_date} demo={st?.demo} />
      <div className="mt-6"><RankingTabs initial={rows} initialKind={kind} /></div>
      <GuestOnly><div className="mt-4"><Locked text="Masuk untuk melihat 100 peringkat teratas dan memilih tanggal." href="/masuk" cta="Masuk" /></div></GuestOnly>
    </>
  );
}

export default function PeringkatPage({ searchParams }: { searchParams: Promise<{ jenis?: string }> }) {
  return (
    <div className="container-x py-10">
      <PageHead title="Peringkat saham" lead="Pengunjung melihat 10 teratas. Akun gratis melihat daftar yang lebih panjang." />
      <Suspense fallback={<Skeleton className="h-96" />}><Content sp={searchParams} /></Suspense>
    </div>
  );
}
