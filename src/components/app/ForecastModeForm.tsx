"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { invalidate } from "@/lib/client-cache";
import { toast } from "@/components/Toaster";
import { ChoiceCard } from "@/components/ui";

type Mode = "stabil" | "dinamis";
const OPTIONS: { id: Mode; title: string; body: string }[] = [
  { id: "stabil", title: "Data seadanya (stabil)", body: "Ramalan dihitung sekali per hari bursa dari data penutupan, lalu dikunci sebelum hasilnya diketahui (walk-forward). Akurasinya jujur ke depan, sekitar 56–60%." },
  { id: "dinamis", title: "Data dinamis", body: "Ramalan dihitung ulang dengan seluruh data terbaru, tanpa walk-forward, memakai metode yang sama dengan Admin. Hasil hari yang dinilai ikut dihitung sehingga kecocokan historisnya tinggi (sekitar 80%), tetapi itu mengukur kecocokan pola, bukan janji akurasi ke depan." },
];
const TITLE: Record<Mode, string> = { stabil: "stabil", dinamis: "dinamis" };

/** Pilihan mode tersimpan otomatis (tanpa tombol simpan), langsung tampil (UI optimistis), dan bisa diurungkan. */
export default function ForecastModeForm({ initial }: { initial: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initial);
  const [busy, setBusy] = useState(false);

  async function save(next: Mode, prev: Mode, undoable = true) {
    setMode(next); setBusy(true);
    const { error } = await createClient().rpc("set_forecast_mode", { p_mode: next });
    setBusy(false);
    if (error) { setMode(prev); toast("Gagal menyimpan pengaturan. Periksa koneksi lalu coba lagi.", "error"); return; }
    invalidate("outlook");
    router.refresh();
    toast(`Mode ${TITLE[next]} aktif.`, "success", undoable ? { label: "Urungkan", onClick: () => void save(prev, next, false) } : undefined);
  }

  return (
    <section className="card space-y-3" aria-labelledby="h-mode">
      <h2 id="h-mode" className="text-lg">Mode data analisis pasar</h2>
      <div role="radiogroup" aria-labelledby="h-mode" className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <ChoiceCard key={o.id} checked={mode === o.id} disabled={busy} title={o.title} body={o.body}
            onSelect={() => { if (o.id !== mode && !busy) void save(o.id, mode); }} />
        ))}
      </div>
      <p className="text-meta text-muted">Halaman Riwayat menampilkan angka sesuai mode yang Anda pilih. Angka mode stabil adalah ukuran akurasi ke depan; angka mode dinamis dihitung ulang dengan data terbaru (in-sample).</p>
    </section>
  );
}
