import { Banner, PageHead } from "@/components/ui";
import QuarantineList from "@/components/admin/QuarantineList";
import { createClient } from "@/lib/supabase/server";
import { dateId } from "@/lib/format";

export const metadata = { title: "Ringkasan" };

export default async function AdminHome() {
  const sb = await createClient();
  const count = async (t: string) => (await sb.from(t).select("*", { count: "exact", head: true })).count ?? 0;
  const [users, subs, stocks, { data: st }, { data: logs }, { data: quar }] = await Promise.all([
    count("profiles"),
    sb.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active").gt("ends_at", new Date().toISOString()).then((r) => r.count ?? 0),
    count("dim_stock"),
    sb.rpc("pub_data_status"),
    sb.from("ingest_log").select("id,source,trade_date,status,rows_in,rows_ok,rows_rejected,message,started_at").order("started_at", { ascending: false }).limit(15),
    sb.from("quarantine").select("id,source,trade_date,reason,row_data").eq("resolved", false).order("created_at", { ascending: false }).limit(20),
  ]);
  const s = Array.isArray(st) ? st[0] : st;
  return (
    <div className="space-y-6">
      <PageHead title="Ringkasan" />
      {s?.demo && <Banner level="warning">Database masih berisi data demo (sintetis). Jalankan purge_demo() sebelum membuka ke publik.</Banner>}
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Pengguna", users], ["Langganan aktif", subs], ["Saham", stocks], ["Data terakhir", s?.stock_date ? dateId(s.stock_date) : "–"]].map(([l, v]) => (
          <div key={String(l)} className="card"><p className="text-[13px] text-muted">{l}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>
      <section><h2 className="mb-2 text-lg">Log pipeline</h2>
        <div className="overflow-x-auto"><table className="data"><thead><tr><th>Waktu</th><th>Sumber</th><th>Tanggal</th><th>Status</th><th className="r">Masuk</th><th className="r">OK</th><th className="r">Ditolak</th><th>Pesan</th></tr></thead>
          <tbody>{(logs ?? []).map((l) => <tr key={l.id}><td>{new Date(l.started_at).toLocaleString("id-ID")}</td><td>{l.source}</td><td>{l.trade_date ?? "–"}</td><td className={l.status === "ok" ? "up" : l.status === "error" ? "down" : ""}>{l.status}</td><td className="r">{l.rows_in}</td><td className="r">{l.rows_ok}</td><td className="r">{l.rows_rejected}</td><td className="max-w-[260px] truncate">{l.message}</td></tr>)}</tbody></table></div>
      </section>
      <section><h2 className="mb-2 text-lg">Karantina data ({quar?.length ?? 0} terbuka)</h2><QuarantineList items={quar ?? []} /></section>
    </div>
  );
}
