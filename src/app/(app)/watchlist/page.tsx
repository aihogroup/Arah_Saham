import WatchlistView from "@/components/app/WatchlistView";
import { PageHead } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Watchlist", robots: { index: false } };

export default async function WatchlistPage() {
  await requireUser("/watchlist");
  return (
    <div className="space-y-6">
      <PageHead title="Watchlist" lead="Saham pilihan Anda dengan harga terakhir." />
      <WatchlistView />
    </div>
  );
}
