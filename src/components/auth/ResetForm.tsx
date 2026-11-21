"use client";

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
      <div><label htmlFor="p" className="mb-1 block text-[14px] font-medium">Kata sandi baru</label><input id="p" type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      {err && <p role="alert" className="down">{err}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
    </form>
  );
}
