import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type Access = {
  userId: string | null;
  email: string | null;
  isAdmin: boolean;
  isPremium: boolean;
  username: string | null;
  profileComplete: boolean;
};

/** Dibaca di server (dinamis). Peran selalu dari database, bukan dari browser. */
export async function getAccess(): Promise<Access> {
  await connection(); // akses dinamis eksplisit sebelum Date.now() milik pustaka auth (menghindari "blocking route")
  const sb = await createClient();
  const { data } = await sb.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return { userId: null, email: null, isAdmin: false, isPremium: false, username: null, profileComplete: false };
  const [{ data: admin }, { data: prem }, { data: prof }] = await Promise.all([
    sb.rpc("is_admin"),
    sb.rpc("is_premium"),
    sb.from("profiles").select("username,birth_date,risk_tolerance,consent_at").eq("id", claims.sub).maybeSingle(),
  ]);
  return {
    userId: claims.sub,
    email: (claims.email as string) ?? null,
    isAdmin: !!admin,
    isPremium: !!prem,
    username: prof?.username ?? null,
    profileComplete: !!(prof?.birth_date && prof?.risk_tolerance && prof?.consent_at),
  };
}

export async function requireUser(next = "/") {
  const a = await getAccess();
  if (!a.userId) redirect(`/masuk?next=${encodeURIComponent(next)}`);
  return a;
}

export async function requireAdmin() {
  const a = await requireUser("/admin");
  if (!a.isAdmin) redirect("/");
  return a;
}
