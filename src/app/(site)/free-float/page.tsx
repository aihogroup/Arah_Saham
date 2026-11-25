import FloatExplorer from "@/components/FloatExplorer";
import { Disclaimer, PageHead } from "@/components/ui";

export const metadata = { title: "Free float dan risiko gorengan", description: "Bandingkan free float, likuiditas, dan skor risiko “gorengan” saham Indonesia." };

export default function FreeFloatPage() {
  return (
    <div className="container-x py-6 sm:py-8">
      <PageHead title="Free float dan risiko gorengan" lead="Free float adalah porsi saham yang benar-benar beredar di publik. Semakin besar free float dan semakin tinggi nilai transaksi, saham cenderung lebih likuid dan lebih sulit digerakkan segelintir pihak." />
      <div className="card mb-6 text-sm text-muted">
        <p>Skor risiko (0–100) menggabungkan free float kecil, nilai transaksi rendah, volatilitas tinggi, dan harga sangat rendah. Skor ≥ 60 berarti rawan, 35–59 waspada sedang, di bawah 35 relatif sulit digoreng. Ini heuristik berbasis data, bukan tuduhan manipulasi dan bukan nasihat investasi. Free float yang belum tercatat diberi nilai tengah.</p>
      </div>
      <FloatExplorer />
      <Disclaimer className="mt-6" />
    </div>
  );
}
