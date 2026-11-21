"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GoogleButton, { OrDivider } from "@/components/auth/GoogleButton";

/** Pendaftaran satu halaman (cepat): Google atau email + kata sandi + nama pengguna + persetujuan. Data profil lain diisi di /lengkapi-profil. */
export default function SignupWizard() {
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "", username: "", consent: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr("Email tidak valid.");
    if (f.password.length < 8) return setErr("Kata sandi minimal 8 karakter.");
    if (!/^[A-Za-z0-9_]{3,24}$/.test(f.username)) return setErr("Nama pengguna 3–24 karakter: huruf, angka, garis bawah.");
    if (!f.consent) return setErr("Anda perlu menyetujui syarat dan kebijakan privasi.");
    setBusy(true); setErr(null);
    const { data, error } = await createClient().auth.signUp({
      email: f.email, password: f.password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=/lengkapi-profil`,
        data: { username: f.username, consent: "true" },
      },
    });
    setBusy(false);
    if (error) {
      const m = error.message.toLowerCase();
      setErr(m.includes("registered") ? "Email sudah terdaftar." : m.includes("username") || m.includes("unique") || m.includes("database") ? "Nama pengguna sudah dipakai atau data tidak valid." : "Pendaftaran gagal. Coba lagi.");
      return;
    }
    if (data.session) { router.replace("/lengkapi-profil"); router.refresh(); return; } // verifikasi email dimatikan: langsung masuk
    setDone(true);
  }

  if (done) return (
    <div role="status" className="space-y-3">
      <h1 className="text-xl">Cek email Anda</h1>
      <p>Kami mengirim tautan verifikasi ke <strong>{f.email}</strong>. Klik tautan itu untuk mengaktifkan akun.</p>
      <Link href="/masuk" className="btn w-full">Ke halaman masuk</Link>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div><h1 className="text-xl">Daftar gratis</h1><p className="text-[13px] text-muted">Cukup satu langkah. Data lain bisa dilengkapi nanti.</p></div>
      <GoogleButton next="/lengkapi-profil" label="Daftar dengan Google" />
      <OrDivider />
      <Field id="email" label="Email"><input id="email" type="email" autoComplete="email" className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
      <Field id="pw" label="Kata sandi (min. 8 karakter)"><input id="pw" type="password" autoComplete="new-password" className="input" value={f.password} onChange={(e) => set("password", e.target.value)} /></Field>
      <Field id="un" label="Nama pengguna"><input id="un" autoComplete="username" className="input" value={f.username} onChange={(e) => set("username", e.target.value)} /></Field>
      <label className="flex items-start gap-2 text-[14px]">
        <input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
        <span>Saya berusia minimal 17 tahun, menyetujui <Link href="/syarat" className="underline" target="_blank">Syarat</Link> dan <Link href="/privasi" className="underline" target="_blank">Kebijakan Privasi</Link>, dan memahami bahwa ini bukan nasihat investasi.</span>
      </label>
      {err && <p role="alert" className="down">{err}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Memproses…" : "Buat akun"}</button>
      <p className="text-center text-[14px]">Sudah punya akun? <Link href="/masuk" className="text-brand">Masuk</Link></p>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-1 block text-[14px] font-medium">{label}</label>{children}</div>;
}
