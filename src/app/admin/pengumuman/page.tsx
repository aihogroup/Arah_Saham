import AnnouncementAdmin from "@/components/admin/AnnouncementAdmin";
import { PageHead } from "@/components/ui";

export const metadata = { title: "Pengumuman" };

export default function AdminPengumuman() {
  return <div className="space-y-4"><PageHead title="Pengumuman" lead="Bilah di atas situs, mis. libur bursa atau keterlambatan data." /><AnnouncementAdmin /></div>;
}
