import type { MetadataRoute } from "next";
import { getPosts, getStockCodes } from "@/lib/data";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, codes] = await Promise.all([getPosts(100), getStockCodes(100)]);
  const fixed = ["", "/pasar", "/saham", "/peringkat", "/indeks", "/blog", "/harga", "/syarat", "/privasi", "/disclaimer"];
  return [
    ...fixed.map((p) => ({ url: `${BASE}${p}`, changeFrequency: "daily" as const })),
    ...codes.map((c) => ({ url: `${BASE}/saham/${c}`, changeFrequency: "daily" as const })),
    ...posts.map((p) => ({ url: `${BASE}/blog/${p.slug}`, lastModified: p.publish_at })),
  ];
}
