import { Disclaimer, PageHead } from "@/components/ui";

export const metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <div className="container-x py-6 sm:py-8">
      <PageHead title="Disclaimer" />
      <div className="prose-id max-w-[760px]">
        <p>Seluruh isi situs ini adalah informasi dan edukasi. Bukan nasihat investasi, bukan rekomendasi beli/jual, dan bukan penawaran efek. Keputusan dan risikonya sepenuhnya menjadi tanggung jawab Anda.</p>
        <p>Perdagangan saham berisiko, termasuk kehilangan seluruh modal. Kinerja masa lalu, termasuk akurasi model yang kami tampilkan, tidak menjamin hasil masa depan.</p>
        <p>Data sumber (Yahoo Finance dan lainnya) dapat terlambat, keliru, atau direvisi. Saat ini harga, volume, IHSG, dan data pasar global berasal dari Yahoo Finance; nilai transaksi dihitung sebagai perkiraan (harga penutupan × volume). Frekuensi, net asing, dan data broker belum tersedia sampai sumber resmi BEI terhubung.</p>
        <p>Akurasi model yang ditampilkan adalah hasil uji walk-forward pada data historis, bukan jaminan kinerja ke depan. Bila situs menampilkan label &ldquo;Data demo&rdquo;, angka tersebut sintetis.</p>
      </div>
      <Disclaimer className="mt-8 max-w-[760px]" />
    </div>
  );
}
