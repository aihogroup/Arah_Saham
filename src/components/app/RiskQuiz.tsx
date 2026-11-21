"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Q = { q: string; a: [string, string, string, string] }; // jawaban berurutan skor 1–4 (paling hati-hati → paling berani)

const QUESTIONS: Q[] = [
  { q: "Apa tujuan utama Anda berinvestasi di saham?", a: ["Menjaga nilai uang dari inflasi", "Pertumbuhan stabil jangka panjang", "Pertumbuhan tinggi, siap bergejolak", "Keuntungan maksimal dalam waktu singkat"] },
  { q: "Berapa lama Anda berencana menahan investasi sebelum uangnya dibutuhkan?", a: ["Kurang dari 1 tahun", "1–3 tahun", "3–7 tahun", "Lebih dari 7 tahun"] },
  { q: "Portofolio Anda turun 20% dalam sebulan. Apa yang Anda lakukan?", a: ["Jual semua agar tidak rugi lebih jauh", "Jual sebagian untuk mengurangi risiko", "Tahan dan tunggu pulih", "Beli tambahan karena harga lebih murah"] },
  { q: "Pilihan mana yang paling nyaman bagi Anda?", a: ["Untung 3%, hampir tanpa risiko rugi", "Untung 8%, kemungkinan rugi sampai 5%", "Untung 15%, kemungkinan rugi sampai 15%", "Untung 30%, kemungkinan rugi sampai 30%"] },
  { q: "Seberapa besar bagian dana yang Anda investasikan terhadap total aset?", a: ["Kurang dari 10%", "10–25%", "25–50%", "Lebih dari 50%"] },
  { q: "Seberapa berpengalaman Anda dengan saham?", a: ["Baru mulai / belum pernah", "Kurang dari 2 tahun", "2–5 tahun", "Lebih dari 5 tahun"] },
  { q: "Bagaimana kondisi keuangan Anda bila investasi ini rugi sebagian?", a: ["Akan sangat mengganggu kebutuhan sehari-hari", "Cukup mengganggu", "Sedikit mengganggu", "Tidak berpengaruh, ada dana darurat dan penghasilan lain"] },
  { q: "Bagaimana perasaan Anda melihat harga saham naik-turun tajam dalam sehari?", a: ["Sangat cemas, sulit tidur", "Gelisah, sering memeriksa harga", "Cukup tenang, itu hal biasa", "Justru melihatnya sebagai peluang"] },
];

export const RISK_INFO: Record<string, { title: string; text: string; loss: string }> = {
  konservatif: { title: "Konservatif", text: "Anda mengutamakan keamanan modal dan lebih nyaman dengan naik-turun harga yang kecil. Pertimbangkan porsi saham berfluktuasi rendah, diversifikasi luas, dan disiplin memotong kerugian lebih awal.", loss: "sekitar 1%" },
  moderat: { title: "Moderat", text: "Anda menerima fluktuasi sedang demi pertumbuhan yang wajar. Keseimbangan antara saham berkualitas dan kas, serta batas kerugian yang jelas, biasanya cocok untuk profil ini.", loss: "sekitar 2%" },
  agresif: { title: "Agresif", text: "Anda siap menanggung fluktuasi besar demi potensi imbal hasil tinggi. Tetap tetapkan batas kerugian per transaksi dan jangan menaruh seluruh dana pada satu saham.", loss: "sekitar 3–5%" },
};

export function categoryOf(score: number): "konservatif" | "moderat" | "agresif" {
  return score <= 16 ? "konservatif" : score <= 24 ? "moderat" : "agresif"; // sama dengan fungsi save_risk_result di database
}

export default function RiskQuiz({ score, assessedAt }: { score: number | null; assessedAt: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ans, setAns] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const step = ans.length;
  const result = score ? categoryOf(score) : null;

  async function choose(v: number) {
    const next = [...ans, v];
    setAns(next);
    if (next.length < QUESTIONS.length) return;
    setBusy(true); setErr(null);
    const total = next.reduce((a, b) => a + b, 0);
    const { error } = await createClient().rpc("save_risk_result", { p_score: total });
    setBusy(false);
    if (error) { setErr("Gagal menyimpan hasil. Coba lagi."); setAns(next.slice(0, -1)); return; }
    setOpen(false); setAns([]); router.refresh();
  }

  return (
    <section className="card space-y-3" aria-labelledby="h-risiko">
      <h2 id="h-risiko" className="text-lg">Profil toleransi risiko</h2>
      {result && !open && (
        <div role="status" className="space-y-2">
          <p>Hasil Anda: <strong className="text-brand">{RISK_INFO[result].title}</strong> <span className="text-muted">(skor {score} dari 32{assessedAt ? `, ${new Date(assessedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}` : ""})</span></p>
          <p className="text-[14px]">{RISK_INFO[result].text}</p>
          <p className="text-[13px] text-muted">Batas rugi harian yang umum untuk profil ini: {RISK_INFO[result].loss} dari modal. Ini gambaran umum, bukan nasihat investasi.</p>
        </div>
      )}
      {!result && !open && <p className="text-[14px] text-muted">Jawab 8 pertanyaan singkat (sekitar 1 menit) untuk mengetahui apakah Anda tergolong konservatif, moderat, atau agresif.</p>}
      {!open && <button type="button" className="btn btn-primary" onClick={() => { setOpen(true); setAns([]); }}>{result ? "Ulangi kuesioner" : "Mulai kuesioner"}</button>}
      {open && (
        <div className="space-y-3" role="group" aria-labelledby="rq-q">
          <p className="text-[13px] text-muted" aria-live="polite">Pertanyaan {Math.min(step + 1, QUESTIONS.length)} dari {QUESTIONS.length}</p>
          <div className="h-1.5 rounded bg-surface" aria-hidden="true"><div className="h-full rounded bg-brand" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} /></div>
          <p id="rq-q" className="font-medium">{QUESTIONS[Math.min(step, QUESTIONS.length - 1)].q}</p>
          <div className="grid gap-2">
            {QUESTIONS[Math.min(step, QUESTIONS.length - 1)].a.map((t, i) => (
              <button key={t} type="button" className="btn justify-start whitespace-normal text-left" disabled={busy} onClick={() => choose(i + 1)}>{t}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setAns(ans.slice(0, -1))}>Kembali</button>}
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setOpen(false); setAns([]); }}>Batal</button>
          </div>
        </div>
      )}
      {err && <p role="alert" className="down">{err}</p>}
    </section>
  );
}
