import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container-x py-24 text-center">
      <h1>Halaman tidak ditemukan</h1>
      <p className="mt-2 text-muted">Alamat yang Anda tuju tidak ada atau sudah dipindahkan.</p>
      <Link href="/" className="btn btn-primary mt-6 inline-flex">Kembali ke beranda</Link>
    </main>
  );
}
