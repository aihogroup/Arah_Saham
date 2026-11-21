import IndexAdmin from "@/components/admin/IndexAdmin";
import { PageHead } from "@/components/ui";

export const metadata = { title: "Indeks" };

export default function AdminIndeks() {
  return <div className="space-y-4"><PageHead title="Komposisi indeks" lead="Tempel daftar kode saham (pisah baris, koma, atau spasi), lihat selisihnya, lalu terbitkan sebagai versi baru. Versi lama tidak ditimpa." /><IndexAdmin /></div>;
}
