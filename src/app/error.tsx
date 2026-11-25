"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui";

/** Batas galat global: pesan awam + coba lagi di tempat (tanpa memuat ulang seluruh aplikasi). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main id="konten" className="container-x py-16">
      <ErrorState
        message={<>Halaman ini belum bisa ditampilkan. Biasanya karena koneksi terputus atau server sedang sibuk. Coba lagi sebentar.{error.digest && <span className="mt-2 block text-caption">Kode: {error.digest}</span>}</>}
        onRetry={reset}
      />
    </main>
  );
}
