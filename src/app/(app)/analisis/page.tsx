import AnalysisPanel from "@/components/app/AnalysisPanel";
import { Disclaimer, Locked, PageHead } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Analisis saya", robots: { index: false } };

export default async function AnalisisPage() {
  const a = await requireUser("/analisis");
  return (
    <div className="space-y-6">
      <PageHead title="Analisis saya" lead="Pilih kumpulan saham, indikator, dan profil risiko. Hasilnya adalah daftar pantauan, bukan perintah beli atau jual." />
      {a.isPremium ? <AnalysisPanel defaultRisk="moderat" /> : <Locked text="Analisis saya adalah fitur Premium. Coba gratis 30 hari atau berlangganan." />}
      <Disclaimer />
    </div>
  );
}
