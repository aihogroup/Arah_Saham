"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { invalidate } from "@/lib/client-cache";

type Mode = "stabil" | "dinamis";
const OPTIONS: { id: Mode; title: string; body: string }[] = [
  { id: "stabil", title: "Data seadanya (stabil)", body: "Ramalan dihitung sekali per hari bursa dari data penutupan, lalu dikunci. Hasilnya tidak berubah-ubah sepanjang hari sehingga mudah dijadikan acuan dan dievaluasi." },
  { id: "dinamis", title: "Data dinamis", body: "Ramalan dihitung ulang setiap Anda membuka halaman, memakai data masukan terbaru dan model terlatih terakhir. Lebih cepat mengikuti perubahan data, tetapi arah dan keyakinan bisa berubah dari ramalan awal." },
];

export default function ForecastModeForm({ initial }: { initial: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function pick(next: Mode) {
    if (next === mode || busy) return;
    const prev = mode;
    setMode(next); setBusy(true); setMsg(null);
    const { error } = await createClient().rpc("set_forecast_mode", { p_mode: next });
    setBusy(false);
    if (error) { setMode(prev); return setMsg({ ok: false, text: "Gagal menyimpan pengaturan." }); }
    invalidate("outlook"); setMsg({ ok: true, text: "Pengaturan tersimpan." });
    router.refresh();
  }

  return (
    <section className="card space-y-3" aria-labelledby="h-mode">
      <h2 id="h-mode" className="text-lg">Mode data analisis pasar</h2>
      <div role="radiogroup" aria-labelledby="h-mode" className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={mode === o.id} disabled={busy} onClick={() => pick(o.id)}
            className={`rounded-lg border p-3 text-left transition-colors ${mode === o.id ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
            <span className="block font-semibold">{mode === o.id ? "● " : "○ "}{o.title}</span>
            <span className="mt-1 block text-[13px] text-muted">{o.body}</span>
          </button>
        ))}
      </div>
      <p className="text-[13px] text-muted">Kedua mode memakai model dan data yang sama. Akurasi mode dinamis belum bisa diukur terpisah karena riwayat perubahan data tidak tersimpan; akurasi terukur hanya untuk ramalan stabil (lihat Riwayat).</p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "up" : "down"}>{msg.text}</p>}
    </section>
  );
}
