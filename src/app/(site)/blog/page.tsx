import Link from "next/link";
import { Suspense } from "react";
import { Empty, PageHead, Skeleton } from "@/components/ui";
import { getPosts } from "@/lib/data";
import { dateId } from "@/lib/format";

export const metadata = { title: "Blog edukasi", description: "Artikel edukasi tentang membaca data pasar saham Indonesia, risiko, dan cara kerja analisis Arah Saham." };

async function List() {
  const posts = await getPosts(30);
  if (posts.length === 0) return <Empty message="Belum ada artikel." />;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {posts.map((p) => (
        <li key={p.slug} className="card overflow-hidden !p-0">
          {p.cover_url && (
            <Link href={`/blog/${p.slug}`} tabIndex={-1} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.cover_url} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
            </Link>
          )}
          <div className="p-4 sm:p-6">
            <p className="text-meta text-muted">{dateId(p.publish_at)}</p>
            <h2 className="mt-1 text-lg"><Link href={`/blog/${p.slug}`} className="hover:underline">{p.title}</Link></h2>
            {p.excerpt && <p className="mt-2 text-muted">{p.excerpt}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function BlogPage() {
  return (
    <div className="container-x py-6 sm:py-8">
      <PageHead title="Blog edukasi" lead="Penjelasan sederhana tentang data, risiko, dan cara kerja analisis." />
      <Suspense fallback={<Skeleton className="h-64" />}><List /></Suspense>
    </div>
  );
}
