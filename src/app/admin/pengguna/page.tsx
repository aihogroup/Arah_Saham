import UserActions from "@/components/admin/UserActions";
import { PageHead } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { dateId } from "@/lib/format";

export const metadata = { title: "Pengguna" };

export default async function PenggunaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const sb = await createClient();
  let query = sb.from("profiles").select("id,username,risk_tolerance,is_active,created_at").order("created_at", { ascending: false }).limit(100);
  if (q) query = query.ilike("username", `%${q.replace(/[%_]/g, "")}%`);
  const { data: users } = await query;
  const ids = (users ?? []).map((u) => u.id);
  const [{ data: roles }, { data: subs }] = await Promise.all([
    sb.from("user_roles").select("user_id,role").in("user_id", ids).eq("role", "admin"),
    sb.from("subscriptions").select("user_id,ends_at,source").in("user_id", ids).eq("status", "active").gt("ends_at", new Date().toISOString()),
  ]);
  const admins = new Set((roles ?? []).map((r) => r.user_id));
  const prem = new Map((subs ?? []).map((s) => [s.user_id, s]));
  return (
    <div className="space-y-4">
      <PageHead title="Pengguna" lead="100 pengguna terbaru. Email tidak ditampilkan di sini." />
      <form className="flex gap-2"><label className="sr-only" htmlFor="q">Cari</label><input id="q" name="q" defaultValue={q} className="input max-w-xs" placeholder="Cari nama pengguna" /><button className="btn">Cari</button></form>
      <div className="table-scroll"><table className="data"><thead><tr><th>Pengguna</th><th>Daftar</th><th>Risiko</th><th>Premium</th><th>Peran</th><th>Aksi</th></tr></thead>
        <tbody>{(users ?? []).map((u) => (
          <tr key={u.id}><td>{u.username}{!u.is_active && <span className="down"> (nonaktif)</span>}</td><td>{dateId(u.created_at)}</td><td>{u.risk_tolerance ?? "–"}</td>
            <td>{prem.has(u.id) ? `sampai ${dateId(prem.get(u.id)!.ends_at)}` : "–"}</td><td>{admins.has(u.id) ? "admin" : "user"}</td>
            <td><UserActions id={u.id} isAdmin={admins.has(u.id)} active={u.is_active} /></td></tr>
        ))}</tbody></table></div>
    </div>
  );
}
