import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ReactMarkdown from "react-markdown";
import { Disclaimer, Skeleton } from "@/components/ui";
import { getPost, getPosts } from "@/lib/data";
import { dateId } from "@/lib/format";

export async function generateStaticParams() {
  const posts = await getPosts(30);
  return posts.length ? posts.map((p) => ({ slug: p.slug })) : [{ slug: "contoh" }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPost(slug);
  if (!p) return { title: "Artikel tidak ditemukan" };
  return { title: p.title, description: p.excerpt ?? undefined, openGraph: { title: p.title, description: p.excerpt ?? undefined, type: "article" } };
}

async function Article({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPost(slug);
  if (!p) notFound();
  return (
    <article className="mx-auto max-w-[720px]">
      <p className="text-[13px] text-muted">{dateId(p.publish_at)}</p>
      <h1 className="mt-1">{p.title}</h1>
      {p.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.cover_url} alt={p.title} className="mt-6 w-full rounded-xl border border-line object-cover" />
      )}
      <div className="prose-id mt-6"><ReactMarkdown skipHtml>{p.body_md}</ReactMarkdown></div>
      <Disclaimer className="mt-10" />
    </article>
  );
}

export default function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  return <div className="container-x py-10"><Suspense fallback={<Skeleton className="h-96" />}><Article params={params} /></Suspense></div>;
}
