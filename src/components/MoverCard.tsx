import Link from "next/link";
import { Delta, Sparkline } from "@/components/ui";
import { compact, price } from "@/lib/format";
import type { Mover } from "@/lib/data";

export function MoverCard({ title, rows, href, showValue }: { title: string; rows: Mover[]; href: string; showValue?: boolean }) {
  return (
    <div className="card flex flex-col">
      <h3>{title}</h3>
      <ul className="mt-3 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.stock_code}>
            <Link href={`/saham/${r.stock_code}`} className="flex min-h-[48px] items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block font-medium">{r.stock_code}</span>
                <span className="block truncate text-[13px] text-muted">{r.name}</span>
              </span>
              <Sparkline data={r.spark} width={56} height={22} />
              <span className="text-right">
                <span className="block font-medium">{showValue ? compact(r.value) : price(r.close)}</span>
                <Delta value={r.change_pct} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={href} className="btn mt-4 w-full">Lihat semua</Link>
    </div>
  );
}
