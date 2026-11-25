import { PageHead } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Audit" };

export default async function AdminAudit() {
  const sb = await createClient();
  const { data } = await sb.from("audit_log").select("id,actor,action,table_name,record_key,created_at").order("created_at", { ascending: false }).limit(100);
  return (
    <div className="space-y-4">
      <PageHead title="Log audit" lead="Perubahan data penting oleh admin. Tidak dapat diubah dari aplikasi." />
      <div className="table-scroll"><table className="data"><thead><tr><th>Waktu</th><th>Aksi</th><th>Tabel</th><th>Kunci</th><th>Pelaku</th></tr></thead>
        <tbody>{(data ?? []).map((a) => <tr key={a.id}><td>{new Date(a.created_at).toLocaleString("id-ID")}</td><td>{a.action}</td><td>{a.table_name}</td><td className="max-w-[240px] truncate">{a.record_key}</td><td className="text-caption">{a.actor?.slice(0, 8) ?? "sistem"}</td></tr>)}</tbody></table></div>
    </div>
  );
}
