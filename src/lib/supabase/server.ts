import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

/** Klien dengan sesi pengguna (cookie). Hanya dipakai di komponen dinamis di dalam <Suspense>. */
export async function createClient() {
  await connection(); // jadikan dinamis secara eksplisit sebelum kode apa pun yang memakai waktu
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* dipanggil dari Server Component */ }
      },
    },
  });
}
