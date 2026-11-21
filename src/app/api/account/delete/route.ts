import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rateLimitShared } from "@/lib/rate-limit";

/** Hapus akun sendiri (UU PDP). Data terkait ikut terhapus lewat ON DELETE CASCADE. */
export async function POST() {
  const sb = await createClient();
  const { data } = await sb.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return NextResponse.json({ error: "Perlu login" }, { status: 401 });
  if (!(await rateLimitShared(`del:${uid}`, 3, 600_000))) return NextResponse.json({ error: "Terlalu banyak percobaan" }, { status: 429 });
  const { error } = await adminClient().auth.admin.deleteUser(uid);
  if (error) return NextResponse.json({ error: "Gagal menghapus akun" }, { status: 500 });
  await sb.auth.signOut();
  return NextResponse.json({ ok: true });
}
