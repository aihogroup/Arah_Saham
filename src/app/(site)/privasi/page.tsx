import { PageHead } from "@/components/ui";

export const metadata = { title: "Kebijakan privasi" };

export default function PrivasiPage() {
  return (
    <div className="container-x py-6 sm:py-8">
      <PageHead title="Kebijakan privasi" lead="Draf awal berdasarkan UU Pelindungan Data Pribadi. Wajib ditinjau konsultan hukum." />
      <div className="prose-id max-w-[760px]">
        <h2>Data yang kami kumpulkan</h2>
        <p>Email, nama pengguna, tanggal lahir (untuk memastikan usia minimal 17 tahun), serta profil opsional: pekerjaan, rentang penghasilan, toleransi risiko, dan batas rugi harian. Data profil dipakai hanya untuk menyesuaikan tampilan analisis.</p>
        <h2>Tujuan</h2>
        <p>Menjalankan akun, langganan, dan keamanan layanan. Kami tidak menjual data pribadi.</p>
        <h2>Pembayaran</h2>
        <p>Diproses Midtrans. Kami tidak menyimpan nomor kartu.</p>
        <h2>Hak Anda</h2>
        <p>Anda dapat melihat, mengubah, dan menghapus akun di halaman Akun. Penghapusan menghapus profil dan data pribadi terkait; catatan transaksi dapat disimpan sesuai kewajiban hukum.</p>
        <h2>Penyimpanan dan keamanan</h2>
        <p>Data disimpan di Supabase dengan pembatasan akses per baris. Akses admin dicatat dalam log audit.</p>
      </div>
    </div>
  );
}
