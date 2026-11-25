import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/beranda";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/beranda";
  if (code) {
    const sb = await createClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      // Pengguna yang belum menyetujui syarat (mis. baru daftar lewat Google) dilengkapi dulu di halaman terpisah.
      const { data: u } = await sb.auth.getUser();
      if (u.user && next !== "/lengkapi-profil") {
        const { data: p } = await sb.from("profiles").select("consent_at").eq("id", u.user.id).maybeSingle();
        if (p && !p.consent_at) return NextResponse.redirect(new URL(`/lengkapi-profil?next=${encodeURIComponent(next)}`, url.origin));
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/masuk?error=tautan", url.origin));
}
