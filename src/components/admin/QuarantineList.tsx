"use client";

import { useRouter } from "next/navigation";
import { resolveQuarantine } from "@/app/admin/actions";
import { Empty } from "@/components/ui";

type Q = { id: number; source: string; trade_date: string | null; reason: string; row_data: unknown };

export default function QuarantineList({ items }: { items: Q[] }) {
  const router = useRouter();
  if (!items.length) return <Empty message="Tidak ada data di karantina." />;
  return (
    <ul className="space-y-2">
      {items.map((q) => (
        <li key={q.id} className="card flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-sm"><strong>{q.source}</strong> · {q.trade_date ?? "–"} · <span className="down">{q.reason}</span></p>
            <pre className="mt-1 overflow-x-auto text-caption text-muted">{JSON.stringify(q.row_data)}</pre></div>
          <button className="btn shrink-0" onClick={async () => { await resolveQuarantine(q.id); router.refresh(); }}>Tandai selesai</button>
        </li>
      ))}
    </ul>
  );
}
