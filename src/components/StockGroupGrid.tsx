import Link from "next/link";
import { T } from "@/components/T";
import { Delta } from "@/components/ui";
import type { StockGroup } from "@/lib/data"; // hanya tipe (terhapus saat build)
import { compact, int } from "@/lib/format";

export type GroupKind = "sektor" | "papan" | "indeks";

/** Kartu ringkasan per sektor / papan / indeks. Klik membuka daftar saham kelompok itu. */
export default function StockGroupGrid({ kind, groups }: { kind: GroupKind; groups: StockGroup[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => {
        const total = g.advancers + g.decliners || 1;
        const empty = g.n === 0;
        return (
          <li key={g.grp}>
            <Link href={`/saham/kelompok/${kind}/${encodeURIComponent(g.grp)}`} className="card card-link block h-full">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg leading-6">{g.grp === "-" ? <T k="stocks.unclassified" /> : g.label}</h3>
                {!empty && <Delta value={g.avg_change} />}
              </div>
              {empty ? <p className="mt-3 text-sm text-muted"><T k="stocks.noIndexData" /></p> : (
                <>
                  <p className="mt-1 text-sm text-muted">{int(g.n)} <T k="stocks.members" /> · <T k="market.value" /> {compact(g.total_value)}</p>
                  <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={`${g.advancers} naik, ${g.decliners} turun`}>
                    <span className="bg-up" style={{ width: `${(g.advancers / total) * 100}%` }} /><span className="bg-down" style={{ width: `${(g.decliners / total) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-caption text-muted"><T k="col.upDown" />: {g.advancers} / {g.decliners}</p>
                </>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
