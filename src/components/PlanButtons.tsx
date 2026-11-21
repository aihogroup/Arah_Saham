"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSignedIn } from "@/components/useSignedIn";
import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window { snap?: { pay: (token: string, cb: Record<string, () => void>) => void } }
}

function loadSnap(src: string, clientKey: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.snap) return resolve();
    const s = document.createElement("script");
    s.src = src; s.setAttribute("data-client-key", clientKey);
    s.onload = () => resolve(); s.onerror = () => reject(new Error("Gagal memuat Midtrans"));
    document.head.appendChild(s);
  });
}

export function BuyButton({ planId, label }: { planId: string; label: string }) {
  const signedIn = useSignedIn();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function buy() {
    if (!signedIn) { router.push("/masuk?next=/harga"); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/midtrans/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan_id: planId }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Gagal membuat pesanan");
      await loadSnap(j.snap_js, j.client_key);
      window.snap!.pay(j.token, {
        onSuccess: () => router.push("/akun?bayar=sukses"),
        onPending: () => router.push("/akun?bayar=menunggu"),
        onError: () => setMsg("Pembayaran gagal. Silakan coba lagi."),
        onClose: () => setBusy(false),
      });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Terjadi kendala.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn btn-primary w-full" onClick={buy} disabled={busy}>{busy ? "Memproses…" : label}</button>
      {msg && <p role="alert" className="mt-2 down">{msg}</p>}
    </div>
  );
}

export function TrialButton() {
  const signedIn = useSignedIn();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function start() {
    if (!signedIn) { router.push("/daftar"); return; }
    setBusy(true); setMsg(null);
    const { data, error } = await createClient().rpc("start_trial");
    setBusy(false);
    if (error) { setMsg("Gagal memulai uji coba."); return; }
    if (!data) { setMsg("Uji coba sudah pernah dipakai atau persetujuan belum lengkap."); return; }
    router.push("/analisis");
  }

  return (
    <div>
      <button className="btn w-full" onClick={start} disabled={busy}>{busy ? "Memproses…" : "Coba Premium gratis"}</button>
      {msg && <p role="alert" className="mt-2 down">{msg}</p>}
    </div>
  );
}
