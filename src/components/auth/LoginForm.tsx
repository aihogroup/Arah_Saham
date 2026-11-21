"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GoogleButton, { OrDivider } from "@/components/auth/GoogleButton";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setErr(error.message.toLowerCase().includes("confirm") ? "Email belum diverifikasi. Cek kotak masuk Anda." : "Email atau kata sandi salah."); return; }
    router.replace(next); router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h1 className="text-xl">Masuk</h1>
      <GoogleButton next={next} label="Masuk dengan Google" />
      <OrDivider />
      <div>
        <label htmlFor="email" className="mb-1 block text-[14px] font-medium">Email</label>
        <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="pw" className="mb-1 block text-[14px] font-medium">Kata sandi</label>
        <input id="pw" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {err && <p role="alert" className="down">{err}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Memproses…" : "Masuk"}</button>
      <div className="flex justify-between text-[14px]">
        <Link href="/lupa-sandi" className="text-brand">Lupa kata sandi?</Link>
        <Link href="/daftar" className="text-brand">Daftar gratis</Link>
      </div>
    </form>
  );
}
