"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GoogleButton, { OrDivider } from "@/components/auth/GoogleButton";
import PasswordInput from "@/components/PasswordInput";
import { Field, SuccessState, fieldAria } from "@/components/ui";
import { check, normalize, rules } from "@/lib/validation";

type Form = { email: string; password: string; username: string; consent: boolean };
type Key = "email" | "password" | "username" | "consent";

/**
 * Pendaftaran satu halaman (Hukum Tesler: sistem menanggung kerumitan; data profil lain diisi nanti di /lengkapi-profil).
 * Galat tampil per kolom setelah kolom ditinggalkan, bukan saat pengguna masih mengetik.
 */
export default function SignupWizard() {
  const router = useRouter();
  const [f, setF] = useState<Form>({ email: "", password: "", username: "", consent: false });
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const touch = (k: Key) => setTouched((t) => ({ ...t, [k]: true }));

  const errors: Record<Key, string | null> = {
    email: check(f.email, rules.required("Email"), rules.email()),
    password: check(f.password, rules.required("Kata sandi"), rules.minLength(8, "Kata sandi")),
    username: check(f.username, rules.required("Nama pengguna"), rules.username()),
    consent: f.consent ? null : "Centang persetujuan untuk melanjutkan.",
  };
  const show = (k: Key) => (touched[k] ? errors[k] : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true, username: true, consent: true });
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true); setErr(null);
    const email = normalize.email(f.email);
    const { data, error } = await createClient().auth.signUp({
      email, password: f.password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=/lengkapi-profil`,
        data: { username: normalize.username(f.username), consent: "true" },
      },
    });
    setBusy(false);
    if (error) {
      const m = error.message.toLowerCase();
      setErr(m.includes("registered") ? "Email sudah terdaftar. Silakan masuk." : m.includes("username") || m.includes("unique") || m.includes("database") ? "Nama pengguna sudah dipakai. Coba nama lain." : "Pendaftaran gagal. Coba lagi.");
      return;
    }
    if (data.session) { router.replace("/lengkapi-profil"); router.refresh(); return; } // verifikasi email dimatikan: langsung masuk
    setDone(true);
  }

  if (done) return (
    <SuccessState title="Akun dibuat. Cek email Anda" action={<Link href="/masuk" className="btn w-full">Ke halaman masuk</Link>}>
      <p>Kami mengirim tautan verifikasi ke <strong className="text-foreground">{normalize.email(f.email)}</strong>. Klik tautan itu untuk mengaktifkan akun, lalu lengkapi profil dalam 1 menit.</p>
    </SuccessState>
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div><h1 className="text-xl">Daftar gratis</h1><p className="text-meta text-muted">Cukup satu langkah. Data lain bisa dilengkapi nanti.</p></div>
      <GoogleButton next="/lengkapi-profil" label="Daftar dengan Google" />
      <OrDivider />
      <Field id="email" label="Email" error={show("email")}>
        <input {...fieldAria("email", show("email"))} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} className="input"
          value={f.email} onChange={(e) => set("email", e.target.value)} onBlur={() => touch("email")} />
      </Field>
      <Field id="pw" label="Kata sandi" hint="Minimal 8 karakter." error={show("password")}>
        <PasswordInput {...fieldAria("pw", show("password"), true)} autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} onBlur={() => touch("password")} />
      </Field>
      <Field id="un" label="Nama pengguna" hint="Tampil di profil. 3–24 karakter: huruf, angka, atau garis bawah." error={show("username")}>
        <input {...fieldAria("un", show("username"), true)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={24} className="input"
          value={f.username} onChange={(e) => set("username", e.target.value)} onBlur={() => touch("username")} />
      </Field>
      <div>
        <label className="flex min-h-[var(--tap-min)] items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--brand)]" checked={f.consent} aria-invalid={show("consent") ? true : undefined} aria-describedby={show("consent") ? "consent-error" : undefined}
            onChange={(e) => { set("consent", e.target.checked); touch("consent"); }} />
          <span>Saya berusia minimal 17 tahun, menyetujui <Link href="/syarat" className="underline" target="_blank">Syarat</Link> dan <Link href="/privasi" className="underline" target="_blank">Kebijakan Privasi</Link>, dan memahami bahwa ini bukan nasihat investasi.</span>
        </label>
        {show("consent") && <p id="consent-error" role="alert" className="mt-1 text-meta down">{show("consent")}</p>}
      </div>
      {err && <p role="alert" className="down">{err}</p>}
      <button className="btn btn-primary w-full" disabled={busy} aria-busy={busy}>{busy ? "Memproses…" : "Buat akun"}</button>
      <p className="text-center text-sm">Sudah punya akun? <Link href="/masuk" className="text-brand">Masuk</Link></p>
    </form>
  );
}
