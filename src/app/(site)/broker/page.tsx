import BrokerTable from "@/components/BrokerTable";
import { PageHead } from "@/components/ui";

export const metadata = { title: "Broker", description: "Nilai, volume, frekuensi, dan pangsa transaksi per broker." };

export default function BrokerPage() {
  return (
    <div className="container-x py-10">
      <PageHead title="Broker" lead="Pangsa nilai transaksi harian per broker. Tersedia untuk akun gratis." />
      <BrokerTable />
    </div>
  );
}
