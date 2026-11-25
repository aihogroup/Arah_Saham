"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GoogleButton, { OrDivider } from "@/components/auth/GoogleButton";
import PasswordInput from "@/components/PasswordInput";
import { Field, fieldAria } from "@/components/ui";
import { check, normalize, rules } from "@/lib/validation";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, pw: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailErr = check(email, rules.required("Email"), rules.email());
  const pwErr = check(password, rules.required("Kata sandi"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, pw: true });
    if (emailErr || pwErr) return;
    setBusy(true); setErr(null);
    const { error } = await createClient().auth.signInWithPassword({ email: normalize.email(email), password });
    setBusy(false);
    if (error) { setErr(error.message.toLowerCase().includes("confirm") ? "Email belum diverifikasi. Cek kotak masuk Anda." : "Email atau kata sandi salah. Periksa lagi, atau atur ulang kata sandi."); return; }
    router.replace(next); router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h1 className="text-xl">Masuk</h1>
      <GoogleButton next={next} label="Masuk dengan Google" />
      <OrDivider />
      <Field id="email" label="Email" error={touched.email ? emailErr : null}>
        <input {...fieldAria("email", touched.email ? emailErr : null)} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required className="input"
          value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))} />
      </Field>
      <Field id="pw" label="Kata sandi" error={touched.pw ? pwErr : null}>
        <PasswordInput {...fieldAria("pw", touched.pw ? pwErr : null)} autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, pw: true }))} />
      </Field>
      {err && <p role="alert" className="down">{err}</p>}
      <button className="btn btn-primary w-full" disabled={busy} aria-busy={busy}>{busy ? "Memproses…" : "Masuk"}</button>
      <div className="flex justify-between text-sm">
        <Link href="/lupa-sandi" className="inline-flex min-h-10 items-center text-brand">Lupa kata sandi?</Link>
        <Link href="/daftar" className="inline-flex min-h-10 items-center text-brand">Daftar gratis</Link>
      </div>
    </form>
  );
}
