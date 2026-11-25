"use client";

import PasswordInput from "@/components/PasswordInput";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetForm() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setErr("Kata sandi minimal 8 karakter.");
    setBusy(true); setErr(null);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr("Gagal mengubah kata sandi. Tautan mungkin sudah kedaluwarsa.");
    router.replace("/akun");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl">Kata sandi baru</h1>
      <div><label htmlFor="p" className="mb-1 block text-sm font-medium">Kata sandi baru</label><PasswordInput id="p" autoComplete="new-password" aria-describedby="p-hint" value={pw} onChange={(e) => setPw(e.target.value)} /><p id="p-hint" className="mt-1 text-meta text-muted">Minimal 8 karakter.</p></div>
      {err && <p role="alert" className="down">{err}</p>}
      <button className="btn btn-primary w-full" disabled={busy} aria-busy={busy}>{busy ? "Menyimpan…" : "Simpan kata sandi"}</button>
    </form>
  );
}
