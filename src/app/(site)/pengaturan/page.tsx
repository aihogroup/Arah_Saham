import PrefsForm from "@/components/PrefsForm";
import { T } from "@/components/T";
import { PageHead } from "@/components/ui";

export const metadata = { title: "Pengaturan tampilan", description: "Atur bahasa, tema, warna aksen, ukuran teks, dan aksesibilitas.", robots: { index: false } };

export default function PengaturanPage() {
  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mx-auto max-w-[760px]">
        <PageHead title={<T k="set.title" />} lead={<T k="set.lead" />} />
        <PrefsForm />
      </div>
    </div>
  );
}
