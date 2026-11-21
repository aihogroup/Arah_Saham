import { redirect } from "next/navigation";
import { PageHead } from "@/components/ui";
import CompleteProfileForm from "@/components/app/CompleteProfileForm";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Lengkapi profil", robots: { index: false } };

export default async function LengkapiProfilPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const a = await requireUser("/lengkapi-profil");
  const { next } = await searchParams;
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/akun";
  const sb = await createClient();
  const { data: p } = await sb.from("profiles").select("username,birth_date,occupation,income_range,consent_at").eq("id", a.userId!).maybeSingle();
  if (p?.consent_at && p.birth_date && p.occupation && p.income_range) redirect(dest); // sudah lengkap
  return (
    <div className="mx-auto max-w-[520px] space-y-6">
      <PageHead title="Lengkapi profil" lead="Hanya butuh sekitar 30 detik. Semua isian ini boleh dilewati dan dapat diubah kapan saja di halaman Akun." />
      <CompleteProfileForm
        next={dest}
        needConsent={!p?.consent_at}
        initial={{ username: p?.username ?? "", birth_date: p?.birth_date ?? "", occupation: p?.occupation ?? "", income_range: p?.income_range ?? "" }}
      />
    </div>
  );
}
