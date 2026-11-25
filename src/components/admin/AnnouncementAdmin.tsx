"use client";

import { confirmDialog } from "@/components/ConfirmDialog";

import { useCallback, useEffect, useState } from "react";
import { revalidateContent } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";

type A = { id: string; message: string; level: string; starts_at: string; ends_at: string | null };

export default function AnnouncementAdmin() {
  const [list, setList] = useState<A[]>([]);
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState("info");
  const [ends, setEnds] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().from("announcements").select("id,message,level,starts_at,ends_at").order("starts_at", { ascending: false }).limit(30);
    setList(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return setErr("Pesan kosong.");
    const { error } = await createClient().from("announcements").insert({ message: message.trim(), level, ends_at: ends ? new Date(ends).toISOString() : null });
    if (error) return setErr("Gagal menyimpan.");
    setErr(null); setMessage(""); setEnds(""); load(); revalidateContent("announcements");
  }
  async function del(id: string) {
    if (!(await confirmDialog({ title: "Hapus pengumuman ini?", message: "Pengumuman langsung hilang dari semua halaman.", confirmLabel: "Hapus", tone: "danger" }))) return;
    const { error } = await createClient().from("announcements").delete().eq("id", id);
    if (error) return setErr("Gagal menghapus pengumuman.");
    load(); revalidateContent("announcements");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card space-y-3">
        <div><label htmlFor="am" className="mb-1 block text-meta">Pesan</label><input id="am" className="input" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} /></div>
        <div className="flex flex-wrap items-end gap-3">
          <div><label htmlFor="al" className="mb-1 block text-meta">Tingkat</label><select id="al" className="input" value={level} onChange={(e) => setLevel(e.target.value)}><option value="info">Info</option><option value="warning">Peringatan</option><option value="critical">Penting</option></select></div>
          <div><label htmlFor="ae" className="mb-1 block text-meta">Berakhir (opsional)</label><input id="ae" type="datetime-local" className="input" value={ends} onChange={(e) => setEnds(e.target.value)} /></div>
          <button className="btn btn-primary">Tayangkan</button>
        </div>
        {err && <p role="alert" className="down">{err}</p>}
      </form>
      <table className="data"><thead><tr><th>Pesan</th><th>Tingkat</th><th>Berakhir</th><th /></tr></thead>
        <tbody>{list.map((a) => <tr key={a.id}><td>{a.message}</td><td>{a.level}</td><td>{a.ends_at ? new Date(a.ends_at).toLocaleString("id-ID") : "–"}</td><td><button className="btn btn-sm btn-danger" onClick={() => del(a.id)}>Hapus</button></td></tr>)}</tbody></table>
    </div>
  );
}
