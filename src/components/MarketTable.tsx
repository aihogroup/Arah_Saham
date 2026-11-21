import Link from "next/link";
import { T } from "@/components/T";
import { Delta, Sparkline } from "@/components/ui";
import { dateId } from "@/lib/format";
import { mprice, symbolHref, type CatalogRow } from "@/lib/market";

/** Tabel instrumen pasar. `full` menambah kolom 3B dan rentang data (halaman kategori). */
export default function MarketTable({ rows, full = false }: { rows: CatalogRow[]; full?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="data">
        <thead>
          <tr>
            <th><T k="col.name" /></th><th className="r"><T k="col.last" /></th><th className="r"><T k="col.d1" /></th>
            <th className="r hidden sm:table-cell"><T k="col.w1" /></th><th className="r hidden md:table-cell"><T k="col.m1" /></th>
            {full && <th className="r hidden lg:table-cell"><T k="col.m3" /></th>}
            <th className="r hidden md:table-cell"><T k="col.ytd" /></th><th className="r hidden lg:table-cell"><T k="col.y1" /></th>
            {full && <th className="r hidden xl:table-cell"><T k="market.since" /></th>}
            <th className="r"><span className="sr-only"><T k="col.trend" /></span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.symbol}>
              <td><Link href={symbolHref(x.symbol)} className="font-medium hover:underline">{x.name}</Link><span className="ml-2 hidden text-[12px] text-muted lg:inline">{x.symbol}</span></td>
              <td className="r">{mprice(x.close)}</td>
              <td className="r"><Delta value={x.change_pct} /></td>
              <td className="r hidden sm:table-cell"><Delta value={x.chg_1w} /></td>
              <td className="r hidden md:table-cell"><Delta value={x.chg_1m} /></td>
              {full && <td className="r hidden lg:table-cell"><Delta value={x.chg_3m} /></td>}
              <td className="r hidden md:table-cell"><Delta value={x.chg_ytd} /></td>
              <td className="r hidden lg:table-cell"><Delta value={x.chg_1y} /></td>
              {full && <td className="r hidden text-[13px] text-muted xl:table-cell">{dateId(x.first_date, { month: "short", year: "numeric" })}</td>}
              <td className="r"><Sparkline data={x.spark} width={56} height={22} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
