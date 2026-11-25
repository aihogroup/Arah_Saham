"use client";

import { confirmDialog } from "@/components/ConfirmDialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/Toaster";
import BirthDateSelect from "@/components/BirthDateSelect";
import { INCOME_RANGES, OCCUPATIONS, birthError } from "@/lib/profile-options";

type P = { username?: string | null; birth_date?: string | null; occupation?: string | null; income_range?: string | null; daily_loss_limit_pct?: number | string | null; experience_years?: number | null; trading_style?: string | null };

export default function ProfileForm({ initial }: { initial: P }) {
  const router = useRouter();
  const [f, setF] = useState({
    username: initial.username ?? "", birth_date: initial.birth_date ?? "", occupation: initial.occupation ?? "", income_range: initial.income_range ?? "",
    daily_loss_limit_pct: String(initial.daily_loss_limit_pct ?? "2"),
    experience_years: String(initial.experience_years ?? ""), trading_style: initial.trading_style ?? "",
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[A-Za-z0-9_]{3,24}$/.test(f.username)) return setMsg({ ok: false, text: "Nama pengguna 3–24 karakter: huruf, angka, garis bawah." });
    const loss = Number(f.daily_loss_limit_pct);
    if (!(loss >= 0.5 && loss <= 20)) return setMsg({ ok: false, text: "Batas rugi harian 0,5%–20%." });
    if (f.birth_date) { const be = birthError(f.birth_date); if (be) return setMsg({ ok: false, text: be }); }
    setBusy(true); setMsg(null);
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("profiles").update({
      username: f.username, birth_date: f.birth_date || null, occupation: f.occupation || null, income_range: f.income_range || null,
      daily_loss_limit_pct: loss, experience_years: f.experience_years === "" ? null : Number(f.experience_years), trading_style: f.trading_style || null,
    }).eq("id", u.user!.id);
    setBusy(false);
    setMsg(error ? { ok: false, text: error.code === "23505" ? "Nama pengguna sudah dipakai." : "Gagal menyimpan." } : { ok: true, text: "Tersimpan." });
    if (!error) { toast("Profil berhasil disimpan"); router.refresh(); } else toast(error.code === "23505" ? "Nama pengguna sudah dipakai" : "Gagal menyimpan profil", "error");
  }

  async function del() {
    const ok = await confirmDialog({ title: "Hapus akun secara permanen?", message: "Akun, profil, watchlist, preset, dan jurnal akan dihapus. Tindakan ini tidak bisa dibatalkan.", confirmLabel: "Hapus akun permanen", tone: "danger" });
    if (!ok) return;
    setBusy(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) { await createClient().auth.signOut(); router.replace("/"); router.refresh(); }
    else { setBusy(false); setMsg({ ok: false, text: "Gagal menghapus akun." }); }
  }

  return (
    <>
      <form onSubmit={save} className="card space-y-4" aria-labelledby="h-profil">
        <h2 id="h-profil" className="text-lg">Profil</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <L id="un" t="Nama pengguna"><input id="un" className="input" value={f.username} onChange={(e) => set("username", e.target.value)} /></L>
          <L id="bd-l" t="Tanggal lahir"><BirthDateSelect id="bd" value={f.birth_date} onChange={(v) => set("birth_date", v)} /></L>
          <L id="oc" t="Pekerjaan"><select id="oc" className="input" value={f.occupation} onChange={(e) => set("occupation", e.target.value)}><option value="">–</option>{f.occupation && !(OCCUPATIONS as readonly string[]).includes(f.occupation) && <option value={f.occupation}>{f.occupation}</option>}{OCCUPATIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select></L>
          <L id="in" t="Penghasilan per bulan"><select id="in" className="input" value={f.income_range} onChange={(e) => set("income_range", e.target.value)}><option value="">–</option>{INCOME_RANGES.map((i) => <option key={i.v} value={i.v}>{i.label}</option>)}</select></L>
          <L id="ls" t="Batas rugi harian (%)"><input id="ls" type="number" step="0.5" min="0.5" max="20" className="input" value={f.daily_loss_limit_pct} onChange={(e) => set("daily_loss_limit_pct", e.target.value)} /></L>
          <L id="ex" t="Pengalaman (tahun)"><input id="ex" type="number" min="0" max="60" className="input" value={f.experience_years} onChange={(e) => set("experience_years", e.target.value)} /></L>
          <L id="ts" t="Gaya trading"><select id="ts" className="input" value={f.trading_style} onChange={(e) => set("trading_style", e.target.value)}><option value="">–</option><option value="scalping">Scalping</option><option value="intraday">Intraday</option><option value="swing_singkat">Swing singkat</option></select></L>
        </div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "up" : "down"}>{msg.text}</p>}
        <div className="action-bar"><button className="btn btn-primary w-full sm:w-auto" disabled={busy} aria-busy={busy}>{busy ? "Menyimpan…" : "Simpan profil"}</button></div>
      </form>

      <section className="card space-y-3" aria-labelledby="h-keluar">
        <h2 id="h-keluar" className="text-lg">Sesi dan data</h2>
        <div className="flex flex-wrap gap-2">
          <form action="/auth/signout" method="post"><button className="btn">Keluar</button></form>
          <button type="button" className="btn btn-danger" onClick={del} disabled={busy}>Hapus akun saya</button>
        </div>
      </section>
    </>
  );
}

function L({ id, t, children }: { id: string; t: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} id={id.endsWith("-l") ? id : undefined} className="mb-1 block text-sm font-medium">{t}</label>{children}</div>;
}
