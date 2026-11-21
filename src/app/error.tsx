"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container-x py-24 text-center" role="alert">
      <h1>Terjadi kendala</h1>
      <p className="mt-2 text-muted">Data belum bisa dimuat. Coba lagi sebentar.</p>
      <button className="btn btn-primary mt-6" onClick={reset}>Muat ulang</button>
    </main>
  );
}
