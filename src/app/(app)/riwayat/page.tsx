import { Disclaimer, Empty, Locked, PageHead } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dateId } from "@/lib/format";

export const metadata = { title: "Riwayat akurasi", robots: { index: false } };

const pc = (v: number | null) => (v === null ? "–" : (v * 100).toFixed(1).replace(".", ",") + "%");

export default async function RiwayatPage() {
  const a = await requireUser("/riwayat");
  if (!a.isPremium) return <div className="space-y-6"><PageHead title="Riwayat akurasi" /><Locked text="Riwayat akurasi tersedia untuk Premium." /></div>;
  const sb = await createClient();
  const [{ data: sum }, { data: ev }] = await Promise.all([
    sb.rpc("accuracy_summary", { p_days: 90 }),
    sb.from("evaluations").select("made_on,target_date,pred_dir,pred_return,actual_return,hit,baseline_up_hit").order("made_on", { ascending: false }).limit(60),
  ]);
  const s = Array.isArray(sum) ? sum[0] : sum;
  return (
    <div className="space-y-6">
      <PageHead title="Riwayat akurasi" lead="Setiap ramalan disimpan sebelum hasilnya diketahui dan tidak dapat diubah. Dibandingkan dengan dua pembanding sederhana." />
      {s && s.n_total > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Akurasi model (90 hari)" value={pc(s.hit_rate)} note={`${s.n_called} ramalan dievaluasi`} />
          <Stat label="Pembanding: selalu naik" value={pc(s.always_up_rate)} />
          <Stat label="Pembanding: acak" value={pc(s.random_rate)} />
        </div>
      ) : <Empty message="Belum ada ramalan yang sudah terbukti." />}
      {ev && ev.length > 0 && (
        <div className="overflow-x-auto"><table className="data">
          <thead><tr><th>Dibuat</th><th>Untuk</th><th>Ramalan</th><th className="r">Aktual</th><th>Hasil</th></tr></thead>
          <tbody>{ev.map((e) => (
            <tr key={e.made_on}><td>{dateId(e.made_on)}</td><td>{dateId(e.target_date)}</td><td>{e.pred_dir}</td>
              <td className={`r ${e.actual_return >= 0 ? "up" : "down"}`}>{e.actual_return >= 0 ? "▲ +" : "▼ −"}{Math.abs(e.actual_return * 100).toFixed(2).replace(".", ",")}%</td>
              <td>{e.hit ? "✓ Tepat" : "✗ Meleset"}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <Disclaimer />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="card"><p className="text-[13px] text-muted">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>{note && <p className="text-[13px] text-muted">{note}</p>}</div>;
}
