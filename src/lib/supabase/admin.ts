import "server-only";
import { createClient } from "@supabase/supabase-js";

/** service_role: hanya server (webhook, aksi admin). Melewati RLS, jadi pemanggil wajib memeriksa peran sendiri. */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diatur");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
