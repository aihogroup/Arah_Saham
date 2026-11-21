"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BirthDateSelect from "@/components/BirthDateSelect";
import { INCOME_RANGES, OCCUPATIONS, birthError } from "@/lib/profile-options";

type Init = { username: string; birth_date: string; occupation: string; income_range: string };

/** Langkah lanjutan setelah daftar (halaman terpisah). Boleh dilewati; persetujuan wajib hanya bila belum pernah diberikan. */
export default function CompleteProfileForm({ initial, next, needConsent }: { initial: Init; next: string; needConsent: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ ...initial, username: /^user_[0-9a-f]{10}$/.test(initial.username) ? "" : initial.username, consent: !needConsent });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.username && !/^[A-Za-z0-9_]{3,24}$/.test(f.username)) return setErr("Nama pengguna 3–24 karakter: huruf, angka, garis bawah.");
    if (f.birth_date) { const be = birthError(f.birth_date); if (be) return setErr(be); }
    if (needConsent && !f.consent) return setErr("Anda perlu menyetujui syarat dan kebijakan privasi untuk melanjutkan.");
    setBusy(true); setErr(null);
    const { error } = await createClient().rpc("save_onboarding", {
      p_username: f.username || null, p_birth: f.birth_date || null, p_occupation: f.occupation || null, p_income: f.income_range || null, p_consent: f.consent,
    });
    setBusy(false);
    if (error) return setErr(error.code === "23505" ? "Nama pengguna sudah dipakai." : error.message.includes("Usia") ? "Usia harus antara 17 dan 100 tahun." : "Gagal menyimpan. Coba lagi.");
    router.replace(next); router.refresh();
  }

  async function skip() {
    if (needConsent) {
      if (!f.consent) return setErr("Setujui syarat dan kebijakan privasi terlebih dulu.");
      setBusy(true);
      await createClient().rpc("save_onboarding", { p_username: null, p_birth: null, p_occupation: null, p_income: null, p_consent: true });
      setBusy(false);
    }
    router.replace(next); router.refresh();
  }

  return (
    <form onSubmit={save} className="card space-y-4" noValidate>
      <L id="un" t="Nama pengguna"><input id="un" autoComplete="username" className="input" value={f.username} onChange={(e) => set("username", e.target.value)} /></L>
      <L id="bd-l" t="Tanggal lahir (usia 17–100 tahun)"><BirthDateSelect id="bd" value={f.birth_date} onChange={(v) => set("birth_date", v)} /></L>
      <L id="oc" t="Pekerjaan">
        <select id="oc" className="input" value={f.occupation} onChange={(e) => set("occupation", e.target.value)}>
          <option value="">Pilih pekerjaan</option>{OCCUPATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </L>
      <L id="in" t="Penghasilan per bulan">
        <select id="in" className="input" value={f.income_range} onChange={(e) => set("income_range", e.target.value)}>
          <option value="">Pilih rentang</option>{INCOME_RANGES.map((i) => <option key={i.v} value={i.v}>{i.label}</option>)}
        </select>
      </L>
      {needConsent && (
        <label className="flex items-start gap-2 text-[14px]">
          <input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
          <span>Saya berusia minimal 17 tahun, menyetujui <Link href="/syarat" className="underline" target="_blank">Syarat</Link> dan <Link href="/privasi" className="underline" target="_blank">Kebijakan Privasi</Link>, dan memahami bahwa ini bukan nasihat investasi.</span>
        </label>
      )}
      {err && <p role="alert" className="down">{err}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={skip} disabled={busy}>Lewati dulu</button>
        <button className="btn btn-primary flex-1" disabled={busy}>{busy ? "Menyimpan…" : "Simpan dan lanjut"}</button>
      </div>
      <p className="text-[13px] text-muted">Ingin tahu profil risiko Anda? Isi kuesioner singkat di halaman Akun setelah ini.</p>
    </form>
  );
}

function L({ id, t, children }: { id: string; t: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} id={id.endsWith("-l") ? id : undefined} className="mb-1 block text-[14px] font-medium">{t}</label>{children}</div>;
}
