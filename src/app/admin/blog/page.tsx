import BlogAdmin from "@/components/admin/BlogAdmin";
import { PageHead } from "@/components/ui";

export const metadata = { title: "Blog" };

export default function AdminBlog() {
  return <div className="space-y-4"><PageHead title="Blog" lead="Konten Markdown. Hanya yang berstatus terbit dan sudah lewat waktu terbit yang tampil di publik." /><BlogAdmin /></div>;
}
