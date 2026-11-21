import StockAdmin from "@/components/admin/StockAdmin";
import { PageHead } from "@/components/ui";

export const metadata = { title: "Saham" };

export default function AdminSaham() {
  return <div className="space-y-4"><PageHead title="Saham" lead="Atur sektor dan papan setiap emiten (ubah langsung di tabel atau impor CSV: kode,nama,sektor,papan,saham_beredar). Keanggotaan indeks diinput di menu Indeks." /><StockAdmin /></div>;
}
