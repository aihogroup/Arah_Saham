import { Skeleton } from "@/components/ui";

/**
 * Kerangka halaman berbentuk judul + kartu angka + daftar. Tampil seketika saat berpindah halaman
 * (Ambang Doherty) dan menahan tempat agar tata letak tidak meloncat saat data tiba.
 */
export default function PageSkeleton({ withContainer = false }: { withContainer?: boolean }) {
  const body = (
    <div className="space-y-6" role="status" aria-label="Memuat halaman">
      <div className="space-y-3">
        <Skeleton className="h-9 w-2/3 max-w-[420px]" />
        <Skeleton className="h-5 w-full max-w-[560px]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}
      </div>
      <span className="sr-only">Memuat…</span>
    </div>
  );
  return withContainer ? <div className="container-x py-6 sm:py-8">{body}</div> : body;
}
