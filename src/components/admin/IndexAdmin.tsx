"use client";

import { useEffect, useState } from "react";
import { revalidateContent } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";

type Diff = { stock_code: string; change_type: string };

export default function IndexAdmin() {
  const [indexes, setIndexes] = useState<{ code: string; name: string }[]>([]);
  const [code, setCode] = useState("");
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [diff, setDiff] = useState<Diff[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    createClient().from("dim_index").select("code,name").neq("code", "COMPOSITE").order("sort_order").then(({ data }) => {
      setIndexes(data ?? []); if (data?.[0]) setCode(data[0].code);
    });
  }, []);

  const codes = () => [...new Set(text.toUpperCase().split(/[\s,;]+/).filter(Boolean))];
  const valid = () => {
    const c = codes();
    if (!code || !date) { setMsg({ ok: false, t: "Pilih indeks dan tanggal efektif." }); return null; }
    if (c.length === 0) { setMsg({ ok: false, t: "Daftar saham kosong." }); return null; }
    const bad = c.filter((x) => !/^[A-Z0-9]{2,8}$/.test(x));
    if (bad.length) { setMsg({ ok: false, t: `Kode tidak valid: ${bad.slice(0, 5).join(", ")}` }); return null; }
    return c;
  };

  async function preview() {
    const c = valid(); if (!c) return;
    const { data, error } = await createClient().rpc("preview_index_diff", { p_index: code, p_codes: c, p_date: date });
    if (error) return setMsg({ ok: false, t: "Gagal membuat pratinjau." });
    setMsg(null); setDiff(data as Diff[]);
  }
  async function publish() {
    const c = valid(); if (!c) return;
    if (!confirm(`Terbitkan versi baru ${code} efektif ${date} (${c.length} saham)?`)) return;
    const { error } = await createClient().rpc("publish_index_version", { p_index: code, p_date: date, p_codes: c, p_note: note || null });
    if (error) return setMsg({ ok: false, t: error.message.includes("tidak ditemukan") || error.message.includes("missing") ? "Ada kode saham yang tidak ada di daftar emiten." : "Gagal menerbitkan." });
    setMsg({ ok: true, t: "Versi baru diterbitkan." }); setDiff(null); setText("");
    revalidateContent("market");
  }

  const ins = diff?.filter((d) => d.change_type === "in") ?? [], outs = diff?.filter((d) => d.change_type === "out") ?? [];
  return (
    <div className="space-y-4">
      <div className="card grid gap-3 sm:grid-cols-3">
        <div><label htmlFor="ix" className="mb-1 block text-[13px]">Indeks</label><select id="ix" className="input" value={code} onChange={(e) => setCode(e.target.value)}>{indexes.map((i) => <option key={i.code} value={i.code}>{i.name}</option>)}</select></div>
        <div><label htmlFor="dt" className="mb-1 block text-[13px]">Tanggal efektif</label><input id="dt" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label htmlFor="nt" className="mb-1 block text-[13px]">Catatan</label><input id="nt" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="sm:col-span-3"><label htmlFor="cd" className="mb-1 block text-[13px]">Daftar kode saham ({codes().length})</label><textarea id="cd" rows={5} className="input" value={text} onChange={(e) => { setText(e.target.value); setDiff(null); }} /></div>
        <div className="flex gap-2 sm:col-span-3"><button className="btn" onClick={preview}>Pratinjau selisih</button><button className="btn btn-primary" onClick={publish} disabled={!diff}>Terbitkan</button></div>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "up" : "down"}>{msg.t}</p>}
      {diff && (
        <div className="card grid gap-4 sm:grid-cols-2" aria-live="polite">
          <div><p className="up font-medium">▲ Masuk ({ins.length})</p><p>{ins.map((d) => d.stock_code).join(", ") || "–"}</p></div>
          <div><p className="down font-medium">▼ Keluar ({outs.length})</p><p>{outs.map((d) => d.stock_code).join(", ") || "–"}</p></div>
        </div>
      )}
    </div>
  );
}
