import { Disclaimer, Empty, Locked, PageHead, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dateId } from "@/lib/format";

export const metadata = { title: "Riwayat akurasi", robots: { index: false } };

const HARI = 1000;
const pc = (v: number | null) => (v === null ? "–" : (v * 100).toFixed(1).replace(".", ",") + "%");

type Year = { yr: number; n_called: number; hit_rate: number; up_share: number };
type Row = { made_on: string; target_date: string; pred_dir: string; actual_return: number; hit: boolean };

export default async function RiwayatPage() {
  const a = await requireUser("/riwayat");
  if (!a.isPremium) return <div className="space-y-6"><PageHead title="Riwayat akurasi" /><Locked text="Riwayat akurasi tersedia untuk Premium." /></div>;
  const sb = await createClient();
  const { data: prof } = await sb.from("profiles").select("forecast_mode").eq("id", a.userId!).maybeSingle();
  const dinamis = prof?.forecast_mode === "dinamis";

  let n = 0, rate: number | null = null, yrs: Year[] = [], rows: Row[] = [];
  if (dinamis) {
    const [{ data: sum }, { data: y }, { data: d }] = await Promise.all([
      sb.rpc("dinamis_ringkasan", { p_n: HARI }),
      sb.rpc("dinamis_per_tahun"),
      sb.from("dinamis_daily").select("made_on,target_date,prediksi,actual_return,hit").not("hit", "is", null).order("made_on", { ascending: false }).limit(HARI),
    ]);
    const s = Array.isArray(sum) ? sum[0] : sum;
    n = s?.n_called ?? 0; rate = s?.hit_rate ?? null; yrs = (y as Year[]) ?? [];
    rows = ((d ?? []) as { made_on: string; target_date: string; prediksi: string; actual_return: number; hit: boolean }[])
      .map((r) => ({ made_on: r.made_on, target_date: r.target_date, pred_dir: r.prediksi, actual_return: r.actual_return, hit: r.hit }));
  } else {
    const { data: mv } = await sb.from("model_versions").select("id").eq("active", true).order("created_at", { ascending: false }).limit(1);
    const modelId = mv?.[0]?.id;
    const [{ data: sum }, { data: y }, { data: ev }] = await Promise.all([
      sb.rpc("accuracy_summary_last", { p_n: HARI }),
      sb.rpc("accuracy_by_year"),
      modelId
        ? sb.from("evaluations").select("made_on,target_date,pred_dir,actual_return,hit").eq("model_id", modelId).order("made_on", { ascending: false }).limit(HARI)
        : Promise.resolve({ data: [] as never[] }),
    ]);
    const s = Array.isArray(sum) ? sum[0] : sum;
    n = s?.n_called ?? 0; rate = s?.hit_rate ?? null; yrs = (y as Year[]) ?? []; rows = (ev ?? []) as Row[];
  }

  return (
    <div className="space-y-6">
      <PageHead title="Riwayat akurasi" lead={dinamis
        ? "Mode dinamis: dihitung ulang dengan data terbaru, termasuk hasil hari yang dinilai."
        : "Mode stabil: setiap ramalan disimpan sebelum hasilnya diketahui dan tidak dapat diubah."} />
      {dinamis && (
        <div className="card border-[var(--warn-fg)]/30 bg-[var(--warn-bg)] text-sm text-[var(--warn-fg)]" role="note">
          <p className="font-medium">Angka ini mengukur kecocokan pola, bukan janji akurasi ke depan.</p>
          <p className="mt-1">Pada mode dinamis, setiap hari dinilai dengan perhitungan saat ini (tanpa walk-forward), jadi hasil hari itu ikut memengaruhi bobot. Untuk ukuran yang jujur ke depan, pilih mode stabil.</p>
        </div>
      )}
      {n > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard accent label={`${dinamis ? "Kecocokan mode dinamis" : "Akurasi model stabil"} (${n} hari terakhir)`} value={pc(rate)}
            note={dinamis ? "Dihitung ulang dengan data terbaru (in-sample)" : "Diuji maju, hasilnya dicocokkan setelah terbukti"} />
        </div>
      ) : <Empty message="Belum ada ramalan yang sudah terbukti." />}
      {yrs.length > 0 && (
        <div>
          <h2 className="text-lg">{dinamis ? "Kecocokan per tahun" : "Akurasi per tahun"}</h2>
          <p className="mb-2 text-meta text-muted">{dinamis
            ? "Perhitungan tanpa walk-forward: hasil tiap hari ikut dihitung dalam penilaiannya."
            : "Diuji maju (walk-forward): tiap hari hanya memakai data sebelum hari itu. Arah IHSG harian memang sulit ditebak, jadi akurasi di atas 50% sudah berarti."}</p>
          <div className="table-scroll"><table className="data">
            <thead><tr><th>Tahun</th><th className="r">Ramalan</th><th className="r">{dinamis ? "Cocok" : "Model"}</th><th className="r">Porsi ramalan naik</th></tr></thead>
            <tbody>{yrs.map((y) => (
              <tr key={y.yr}><td>{y.yr}</td><td className="r">{y.n_called}</td><td className="r">{pc(y.hit_rate)}</td><td className="r">{pc(y.up_share)}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
      {rows.length > 0 && (
        <div className="max-h-[640px] overflow-auto"><table className="data">
          <thead><tr><th>Dibuat</th><th>Untuk</th><th>Ramalan</th><th className="r">Aktual</th><th>Hasil</th></tr></thead>
          <tbody>{rows.map((e) => (
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

