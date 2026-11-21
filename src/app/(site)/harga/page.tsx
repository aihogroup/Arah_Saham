import { Check } from "lucide-react";
import { Suspense } from "react";
import { BuyButton, TrialButton } from "@/components/PlanButtons";
import { Disclaimer, PageHead, Skeleton } from "@/components/ui";
import { getPlans } from "@/lib/data";
import { idr } from "@/lib/format";

export const metadata = { title: "Harga", description: "Paket gratis dan Premium Arah Saham. Pembayaran aman lewat Midtrans." };

const FREE = ["Ringkasan pasar dan peringkat harian", "Daftar dan detail saham", "Data broker (login)", "Unduh CSV 5 kali per hari", "Watchlist"];
const PREMIUM = ["Semua fitur gratis", "Analisis saya: pilih saham, indikator, dan profil risiko", "Prakiraan IHSG dengan tingkat keyakinan", "Skor saham dan alasan tiap komponen", "Riwayat akurasi vs pembanding", "Unduh CSV 50 kali per hari"];

async function Plans() {
  const plans = await getPlans();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="card">
        <h2 className="text-lg">Gratis</h2>
        <p className="mt-1 text-2xl font-semibold tabular-nums">Rp0</p>
        <ul className="mt-4 space-y-2">{FREE.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-1 shrink-0 text-brand" aria-hidden="true" />{f}</li>)}</ul>
      </div>
      {plans.map((p) => (
        <div key={p.id} className="card border-brand">
          <h2 className="text-lg">{p.name}</h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{idr(p.price_idr)}<span className="text-[14px] font-normal text-muted"> / {p.duration_days >= 365 ? "tahun" : "bulan"}</span></p>
          <ul className="mt-4 space-y-2">{PREMIUM.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-1 shrink-0 text-brand" aria-hidden="true" />{f}</li>)}</ul>
          <div className="mt-5 space-y-2"><BuyButton planId={p.id} label="Berlangganan" /></div>
        </div>
      ))}
    </div>
  );
}

export default function HargaPage() {
  return (
    <div className="container-x py-10">
      <PageHead title="Harga" lead="Mulai gratis. Upgrade saat Anda butuh analisis yang dipersonalisasi." />
      <Suspense fallback={<Skeleton className="h-96" />}><Plans /></Suspense>
      <div className="mx-auto mt-6 max-w-[360px]"><TrialButton /></div>
      <p className="mt-6 text-center text-[13px] text-muted">Pembayaran diproses Midtrans (kartu, transfer bank, e-wallet). Langganan tidak diperpanjang otomatis.</p>
      <Disclaimer className="mt-8" />
    </div>
  );
}
