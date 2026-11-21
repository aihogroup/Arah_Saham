import { Banner, PageHead } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { dateId } from "@/lib/format";

export const metadata = { title: "Model & data" };

const pc = (v: number | null) => (v === null ? "–" : (v * 100).toFixed(1).replace(".", ",") + "%");

export default async function AdminModel() {
  const sb = await createClient();
  const [{ data: models }, { data: fits }, { data: sum }, { data: st }, { data: dq }] = await Promise.all([
    sb.from("model_versions").select("id,description,active,created_at").order("created_at", { ascending: false }),
    sb.from("model_fits").select("model_id,fit_date,lambda,n_train").order("fit_date", { ascending: false }).limit(10),
    sb.rpc("accuracy_summary", { p_days: 365 }),
    sb.rpc("pub_data_status"),
    sb.rpc("data_quality"),
  ]);
  const s = Array.isArray(sum) ? sum[0] : sum;
  const d = Array.isArray(st) ? st[0] : st;
  return (
    <div className="space-y-6">
      <PageHead title="Model & data" />
      {d?.demo && <Banner level="warning">Akurasi di bawah dihitung dari data demo yang disisipi sinyal buatan. Angka ini tidak mencerminkan kinerja nyata.</Banner>}
      {s && <div className="grid gap-3 sm:grid-cols-3">
        <div className="card"><p className="text-[13px] text-muted">Akurasi model (365 hari)</p><p className="text-2xl font-semibold">{pc(s.hit_rate)}</p><p className="text-[13px] text-muted">{s.n_called} ramalan dievaluasi</p></div>
        <div className="card"><p className="text-[13px] text-muted">Selalu naik</p><p className="text-2xl font-semibold">{pc(s.always_up_rate)}</p></div>
        <div className="card"><p className="text-[13px] text-muted">Acak</p><p className="text-2xl font-semibold">{pc(s.random_rate)}</p></div>
      </div>}
      {dq && <DataQuality q={dq as Record<string, number | string | null>} />}
      <table className="data"><thead><tr><th>Versi</th><th>Deskripsi</th><th>Aktif</th><th>Dibuat</th></tr></thead>
        <tbody>{(models ?? []).map((m) => <tr key={m.id}><td>{m.id}</td><td>{m.description}</td><td>{m.active ? "✓" : "–"}</td><td>{dateId(m.created_at)}</td></tr>)}</tbody></table>
      <section><h2 className="mb-2 text-lg">Pelatihan terakhir</h2>
        <table className="data"><thead><tr><th>Model</th><th>Tanggal</th><th className="r">λ</th><th className="r">Data latih</th></tr></thead>
          <tbody>{(fits ?? []).map((f) => <tr key={`${f.model_id}${f.fit_date}`}><td>{f.model_id}</td><td>{dateId(f.fit_date)}</td><td className="r">{f.lambda}</td><td className="r">{f.n_train}</td></tr>)}</tbody></table></section>
    </div>
  );
}

// Ambang kualitas: nilai "masalah" harus 0; "info" hanya ditampilkan.
const CHECKS: { k: string; label: string; kind: "masalah" | "info" }[] = [
  { k: "saham_hari_terakhir", label: "Saham pada hari terakhir", kind: "info" },
  { k: "saham_min_30_hari", label: "Saham minimum per hari (30 hari)", kind: "info" },
  { k: "baris_tanpa_transaksi", label: "Saham tanpa transaksi (hari terakhir)", kind: "info" },
  { k: "baris_tanpa_perubahan_persen", label: "Persen ubah kosong (hari terakhir)", kind: "info" },
  { k: "baris_high_lt_low", label: "Baris dengan high < low", kind: "masalah" },
  { k: "baris_close_di_luar_rentang", label: "Penutupan di luar low–high", kind: "masalah" },
  { k: "kode_tanpa_dim_stock", label: "Kode saham tanpa master", kind: "masalah" },
  { k: "hari_tanpa_data_broker_30h", label: "Hari tanpa data broker (30 hari)", kind: "masalah" },
  { k: "hari_tanpa_ihsg_30h", label: "Hari tanpa IHSG (30 hari)", kind: "masalah" },
  { k: "ukuran_db_mb", label: "Ukuran database (MB)", kind: "info" },
];

function DataQuality({ q }: { q: Record<string, number | string | null> }) {
  return (
    <section aria-labelledby="h-dq" className="card">
      <h2 id="h-dq" className="text-lg">Kualitas data <span className="text-[13px] font-normal text-muted">· data terakhir {q.tanggal_terakhir ? dateId(String(q.tanggal_terakhir)) : "–"}</span></h2>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {CHECKS.map((c) => {
          const v = q[c.k]; const bad = c.kind === "masalah" && Number(v ?? 0) > 0;
          return <div key={c.k} className="flex justify-between border-b border-line py-1 text-[14px]"><dt>{c.label}</dt><dd className={`tabular-nums ${bad ? "down font-semibold" : ""}`}>{v ?? "–"}{bad ? " ✗" : c.kind === "masalah" ? " ✓" : ""}</dd></div>;
        })}
      </dl>
    </section>
  );
}
