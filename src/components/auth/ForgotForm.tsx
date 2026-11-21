"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/reset-sandi` });
    setBusy(false); setSent(true); // selalu sukses agar email terdaftar tidak bisa ditebak
  }

  if (sent) return <div role="status" className="space-y-3"><h1 className="text-xl">Cek email Anda</h1><p>Jika email terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim.</p><Link href="/masuk" className="btn w-full">Kembali ke masuk</Link></div>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl">Lupa kata sandi</h1>
      <div><label htmlFor="e" className="mb-1 block text-[14px] font-medium">Email</label><input id="e" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Mengirim…" : "Kirim tautan"}</button>
    </form>
  );
}
