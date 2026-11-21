"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { revalidateContent } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";

type S = { code: string; name: string; sector: string | null; board: string | null; listed_shares: number | null; active: boolean };
const CODE = /^[A-Z0-9]{2,8}$/;
const FILTERS = [{ id: "all", label: "Semua" }, { id: "nosector", label: "Tanpa sektor" }, { id: "noboard", label: "Tanpa papan" }, { id: "inactive", label: "Nonaktif" }] as const;

function parseCsv(text: string) {
  const rows: Omit<S, "active">[] = []; const errors: string[] = [];
  text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const c = line.split(",").map((x) => x.trim());
    if (i === 0 && c[0].toLowerCase() === "kode") return;
    const code = c[0]?.toUpperCase();
    if (!CODE.test(code ?? "")) return errors.push(`Baris ${i + 1}: kode tidak valid`);
    if (!c[1]) return errors.push(`Baris ${i + 1}: nama kosong`);
    const sh = c[4] ? Number(c[4]) : null;
    if (sh !== null && !(sh >= 0)) return errors.push(`Baris ${i + 1}: saham beredar tidak valid`);
    rows.push({ code, name: c[1], sector: c[2] || null, board: c[3] || null, listed_shares: sh });
  });
  return { rows, errors };
}

export default function StockAdmin() {
  const [list, setList] = useState<S[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [form, setForm] = useState({ code: "", name: "", sector: "", board: "", listed_shares: "" });
  const [csv, setCsv] = useState("");
  const [limit, setLimit] = useState(100);

  const load = useCallback(async () => {
    // PostgREST membatasi 1000 baris per permintaan: ambil bertahap.
    const sb = createClient(); const all: S[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("dim_stock").select("code,name,sector,board,listed_shares,active").order("code").range(from, from + 999);
      if (error) { setMsg({ ok: false, t: "Gagal memuat daftar saham." }); break; }
      all.push(...((data as S[]) ?? []));
      if (!data || data.length < 1000) break;
    }
    setList(all);
  }, []);
  useEffect(() => { load(); }, [load]);

  const sectors = useMemo(() => [...new Set(list.map((s) => s.sector).filter(Boolean))].sort() as string[], [list]);
  const boards = useMemo(() => [...new Set(list.map((s) => s.board).filter(Boolean))].sort() as string[], [list]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    if (!CODE.test(code) || !form.name.trim()) return setMsg({ ok: false, t: "Kode atau nama tidak valid." });
    const { error } = await createClient().from("dim_stock").upsert({ code, name: form.name.trim(), sector: form.sector || null, board: form.board || null, listed_shares: form.listed_shares ? Number(form.listed_shares) : null, source: "admin" });
    setMsg(error ? { ok: false, t: "Gagal menyimpan." } : { ok: true, t: `${code} tersimpan.` });
    if (!error) { setForm({ code: "", name: "", sector: "", board: "", listed_shares: "" }); load(); revalidateContent("market"); }
  }
  async function importCsv() {
    const { rows, errors } = parseCsv(csv);
    if (errors.length) return setMsg({ ok: false, t: errors.slice(0, 5).join(" · ") });
    if (!rows.length) return setMsg({ ok: false, t: "CSV kosong." });
    const { error } = await createClient().from("dim_stock").upsert(rows.map((r) => ({ ...r, source: "admin" })));
    setMsg(error ? { ok: false, t: "Impor gagal." } : { ok: true, t: `${rows.length} baris diimpor.` });
    if (!error) { setCsv(""); load(); revalidateContent("market"); }
  }
  async function toggle(s: S) {
    await createClient().from("dim_stock").update({ active: !s.active }).eq("code", s.code);
    load(); revalidateContent("market");
  }
  /** Ubah sektor/papan satu saham langsung di tabel (disimpan saat kolom kehilangan fokus). */
  async function patch(s: S, field: "sector" | "board", raw: string) {
    const value = raw.trim() || null;
    if (value === s[field]) return;
    const { error } = await createClient().from("dim_stock").update({ [field]: value }).eq("code", s.code);
    if (error) return setMsg({ ok: false, t: `Gagal mengubah ${s.code}.` });
    setList((prev) => prev.map((x) => (x.code === s.code ? { ...x, [field]: value } : x)));
    setMsg({ ok: true, t: `${s.code}: ${field === "sector" ? "sektor" : "papan"} diperbarui.` });
    revalidateContent("market");
  }

  const matched = list.filter((s) =>
    (!q || s.code.includes(q.toUpperCase()) || s.name.toLowerCase().includes(q.toLowerCase())) &&
    (filter === "all" || (filter === "nosector" && !s.sector) || (filter === "noboard" && !s.board) || (filter === "inactive" && !s.active)));
  const shown = matched.slice(0, limit);

  return (
    <div className="space-y-6">
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "up" : "down"}>{msg.t}</p>}
      <datalist id="sektor-list">{sectors.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="papan-list">{boards.map((x) => <option key={x} value={x} />)}</datalist>
      <form onSubmit={save} className="card grid gap-3 sm:grid-cols-6">
        {(["code", "name", "sector", "board", "listed_shares"] as const).map((k) => (
          <div key={k} className={k === "name" ? "sm:col-span-2" : ""}><label className="mb-1 block text-[13px]" htmlFor={`s-${k}`}>{({ code: "Kode", name: "Nama", sector: "Sektor", board: "Papan", listed_shares: "Saham beredar" })[k]}</label>
            <input id={`s-${k}`} className="input" list={k === "sector" ? "sektor-list" : k === "board" ? "papan-list" : undefined} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
        ))}
        <div className="flex items-end"><button className="btn btn-primary w-full">Simpan</button></div>
      </form>
      <div className="card space-y-2"><label htmlFor="csv" className="text-[14px] font-medium">Impor CSV</label>
        <textarea id="csv" rows={4} className="input" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"kode,nama,sektor,papan,saham_beredar\nBBCA,Bank Central Asia Tbk.,Financials,Utama,123275050000"} />
        <button className="btn" onClick={importCsv} disabled={!csv.trim()}>Validasi dan impor</button></div>

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="sq">Cari</label><input id="sq" className="input max-w-xs" placeholder="Cari kode/nama" value={q} onChange={(e) => { setQ(e.target.value); setLimit(100); }} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
            {FILTERS.map((f) => <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => { setFilter(f.id); setLimit(100); }}>{f.label}{f.id === "nosector" ? ` (${list.filter((s) => !s.sector).length})` : f.id === "noboard" ? ` (${list.filter((s) => !s.board).length})` : ""}</button>)}
          </div>
          <p className="ml-auto text-[13px] text-muted">{matched.length.toLocaleString("id-ID")} dari {list.length.toLocaleString("id-ID")} saham · klik sel Sektor/Papan untuk mengubah</p>
        </div>
        <div className="overflow-x-auto"><table className="data"><thead><tr><th>Kode</th><th>Nama</th><th>Sektor</th><th>Papan</th><th>Status</th></tr></thead>
          <tbody>{shown.map((s) => (
            <tr key={s.code}><td className="font-medium">{s.code}</td><td className="max-w-[260px] truncate">{s.name}</td>
              <td><input aria-label={`Sektor ${s.code}`} className="input !min-h-[36px] !py-0 text-[14px]" list="sektor-list" defaultValue={s.sector ?? ""} key={`${s.code}-s-${s.sector}`} placeholder="–" onBlur={(e) => patch(s, "sector", e.target.value)} /></td>
              <td><input aria-label={`Papan ${s.code}`} className="input !min-h-[36px] !py-0 text-[14px]" list="papan-list" defaultValue={s.board ?? ""} key={`${s.code}-b-${s.board}`} placeholder="–" onBlur={(e) => patch(s, "board", e.target.value)} /></td>
              <td><button className="underline" onClick={() => toggle(s)}>{s.active ? "Aktif" : "Nonaktif"}</button></td></tr>
          ))}</tbody></table></div>
        {matched.length > limit && <div className="mt-4 text-center"><button className="btn" onClick={() => setLimit((l) => l + 200)}>Tampilkan lebih banyak</button></div>}
      </div>
    </div>
  );
}
