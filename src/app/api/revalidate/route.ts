import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

const TAGS = ["market", "blog", "announcements"];

/** Dipanggil pipeline setelah data baru masuk. Header: x-revalidate-secret. */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET ?? "";
  const got = req.headers.get("x-revalidate-secret") ?? "";
  const a = Buffer.from(secret), b = Buffer.from(got);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { tags?: string[] };
  const tags = (body.tags ?? TAGS).filter((t) => TAGS.includes(t));
  for (const t of tags) revalidateTag(t, "max");
  return NextResponse.json({ revalidated: tags });
}
