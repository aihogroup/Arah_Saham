import { PageHead } from "@/components/ui";

export const metadata = { title: "Syarat dan ketentuan" };

export default function SyaratPage() {
  return (
    <div className="container-x py-10">
      <PageHead title="Syarat dan ketentuan" lead="Draf awal. Wajib ditinjau konsultan hukum sebelum peluncuran." />
      <div className="prose-id max-w-[760px]">
        <h2>Layanan</h2>
        <p>Arah Saham menyediakan data dan analisis pasar saham Indonesia untuk tujuan informasi dan edukasi. Layanan bukan nasihat investasi, bukan ajakan membeli atau menjual efek, dan kami bukan penasihat investasi berlisensi.</p>
        <h2>Akun</h2>
        <p>Pengguna berusia minimal 17 tahun, bertanggung jawab atas keamanan akunnya, dan memberikan data yang benar.</p>
        <h2>Langganan Premium</h2>
        <p>Pembayaran melalui Midtrans. Masa aktif dihitung sejak pembayaran berhasil dan diperpanjang jika Anda membayar lagi sebelum berakhir. Kebijakan pengembalian dana mengikuti ketentuan yang ditetapkan pengelola.</p>
        <h2>Penggunaan data</h2>
        <p>Data dilarang disalin massal atau dijual kembali. Unduhan CSV dibatasi kuota harian dan untuk penggunaan pribadi.</p>
        <h2>Batasan tanggung jawab</h2>
        <p>Kami tidak bertanggung jawab atas kerugian akibat keputusan investasi. Data berasal dari sumber pihak ketiga dan dapat terlambat atau keliru.</p>
      </div>
    </div>
  );
}
