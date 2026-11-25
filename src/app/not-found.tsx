import Link from "next/link";
import { SearchX } from "lucide-react";

// Halaman 404: beri jalan keluar yang paling mungkin dicari (Hukum Hick: tiga pilihan, satu yang utama).
const LINKS = [
  { href: "/saham", label: "Cari saham" },
  { href: "/pasar", label: "Ringkasan pasar" },
];

export default function NotFound() {
  return (
    <main id="konten" className="container-x flex flex-col items-center gap-3 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface text-muted" aria-hidden="true"><SearchX size={26} /></span>
      <h1>Halaman tidak ditemukan</h1>
      <p className="measure text-muted">Alamat yang Anda tuju tidak ada atau sudah dipindahkan. Coba salah satu tujuan berikut.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn btn-primary">Kembali ke beranda</Link>
        {LINKS.map((l) => <Link key={l.href} href={l.href} className="btn">{l.label}</Link>)}
      </div>
    </main>
  );
}
