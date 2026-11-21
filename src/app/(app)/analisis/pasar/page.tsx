import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Disclaimer, Empty, Locked, PageHead } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dateId } from "@/lib/format";
import { reasonText } from "@/lib/labels";

export const metadata = { title: "Analisis pasar harian", robots: { index: false } };

const PER_PAGE = 20;
type Reason = { feature: string; contribution: number };

export default async function AnalisisPasarPage({ searchParams }: { searchParams: Promise<{ hal?: string }> }) {
  const a = await requireUser("/analisis/pasar");
  const { hal } = await searchParams;
  const page = Math.max(1, Number.parseInt(hal ?? "1", 10) || 1);

  const head = (
    <>
      <Link href="/analisis" className="mb-3 inline-flex items-center gap-1 text-[14px] text-brand"><ArrowLeft size={16} aria-hidden="true" /> Analisis saya</Link>
      <PageHead title="Analisis pasar harian" lead="Kondisi pasar yang dihitung pada hari-hari sebelumnya, beserta hasil sebenarnya di hari berikutnya." />
    </>
  );
  if (!a.isPremium) return <div className="space-y-6">{head}<Locked text="Riwayat analisis pasar tersedia untuk Premium." /></div>;

  const sb = await createClient();
  const from = (page - 1) * PER_PAGE;
  const { data: fc, count } = await sb.from("forecasts")
    .select("made_on,target_date,direction,confidence,pred_return,reasons", { count: "exact" })
    .order("made_on", { ascending: false }).range(from, from + PER_PAGE - 1);
  const dates = (fc ?? []).map((f) => f.made_on);
  const { data: ev } = dates.length
    ? await sb.from("evaluations").select("made_on,actual_return,hit").in("made_on", dates)
    : { data: [] as { made_on: string; actual_return: number; hit: boolean | null }[] };
  const actual = new Map((ev ?? []).map((e) => [e.made_on, e]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));

  return (
    <div className="space-y-6">
      {head}
      {!fc || fc.length === 0 ? <Empty message="Belum ada riwayat analisis pasar." /> : (
        <ul className="space-y-3">
          {fc.map((f) => {
            const e = actual.get(f.made_on);
            const reasons = (f.reasons as Reason[]) ?? [];
            const dirCls = f.direction === "turun" ? "down" : "up";
            const dirTxt = f.direction === "turun" ? "▼ Condong turun" : "▲ Condong naik";
            return (
              <li key={f.made_on} className="card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg">{dateId(f.target_date)}</h2>
                  <p className="text-[13px] text-muted">dihitung {dateId(f.made_on)}</p>
                </div>
                <p className="mt-1 font-medium"><span className={dirCls}>{dirTxt}</span> <span className="text-[14px] font-normal text-muted">· keyakinan {Math.round(f.confidence * 100)}%</span></p>
                {reasons.length > 0 && <ul className="mt-2 list-disc pl-5 text-[14px]">{reasons.slice(0, 3).map((r) => <li key={r.feature}>{reasonText(r.feature, r.contribution)}</li>)}</ul>}
                <p className="mt-3 border-t border-line pt-2 text-[14px]">
                  {e ? (<>
                    Hasil sebenarnya: <span className={e.actual_return >= 0 ? "up" : "down"}>{e.actual_return >= 0 ? "▲ +" : "▼ −"}{Math.abs(e.actual_return * 100).toFixed(2).replace(".", ",")}%</span>
                    {" · "}{e.hit ? "✓ tepat" : "✗ meleset"}
                  </>) : <span className="text-muted">Hasil belum tersedia.</span>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Halaman" className="flex items-center justify-between">
          {page > 1 ? <Link className="btn" href={`/analisis/pasar?hal=${page - 1}`}>← Lebih baru</Link> : <span />}
          <span className="text-[14px] text-muted">Halaman {page} dari {pages}</span>
          {page < pages ? <Link className="btn" href={`/analisis/pasar?hal=${page + 1}`}>Lebih lama →</Link> : <span />}
        </nav>
      )}
      <Disclaimer />
    </div>
  );
}
