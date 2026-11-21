import { createClient } from "@supabase/supabase-js";

/** Klien tanpa sesi/cookie untuk data publik yang di-cache bersama. Tidak pernah memuat data pribadi. */
export function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
