import { redirect } from "next/navigation";
import PremiumHome from "@/components/app/PremiumHome";
import { Disclaimer, PageHead } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Beranda Premium", robots: { index: false } };

export default async function BerandaPage() {
  const a = await requireUser("/beranda");
  if (!a.isPremium) redirect("/akun");
  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <PageHead title={`Halo${a.username ? `, ${a.username}` : ""}`} lead="Ringkasan IHSG, saham pilihan sesuai preferensi Anda, dan saran untuk portofolio Anda hari ini." />
      <PremiumHome />
      <Disclaimer />
    </div>
  );
}
