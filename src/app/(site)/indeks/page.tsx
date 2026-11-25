import Link from "next/link";
import { Suspense } from "react";
import { Empty, PageHead, Skeleton } from "@/components/ui";
import { getIndexChanges } from "@/lib/data";
import { dateId } from "@/lib/format";

export const metadata = { title: "Perubahan indeks", description: "Riwayat saham masuk dan keluar IDX30, LQ45, IDX80, dan indeks lain. Versi lama tidak pernah ditimpa." };

async function Content() {
  const { changes, indexes } = await getIndexChanges(80);
  const names = Object.fromEntries(indexes.map((i) => [i.code, i.name]));
  const groups = new Map<string, typeof changes>();
  for (const c of changes) { const k = `${c.index_code}|${c.effective_date}`; groups.set(k, [...(groups.get(k) ?? []), c]); }
  if (groups.size === 0) return <Empty message="Belum ada perubahan komposisi indeks." />;
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([k, list]) => {
        const [code, date] = k.split("|");
        return (
          <div key={k} className="card">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h3>{names[code] ?? code}</h3><p className="text-muted">Efektif {dateId(date)}</p></div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {(["in", "out"] as const).map((t) => (
                <div key={t}>
                  <p className={`text-meta font-medium ${t === "in" ? "up" : "down"}`}>{t === "in" ? "▲ Masuk" : "▼ Keluar"}</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {list.filter((c) => c.change_type === t).map((c) => <li key={c.stock_code}><Link className="chip" href={`/saham/${c.stock_code}`} title={c.name}>{c.stock_code}</Link></li>)}
                    {list.filter((c) => c.change_type === t).length === 0 && <li className="text-muted">–</li>}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function IndeksPage() {
  return (
    <div className="container-x py-6 sm:py-8">
      <PageHead title="Perubahan indeks" lead="Saham yang masuk dan keluar tiap indeks. Setiap perubahan menjadi versi baru; analisis lama tetap memakai komposisi yang berlaku pada harinya." />
      <Suspense fallback={<Skeleton className="h-64" />}><Content /></Suspense>
    </div>
  );
}
