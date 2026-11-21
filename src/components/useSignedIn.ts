"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Status login di sisi klien (untuk halaman publik yang di-cache). Hak akses sebenarnya dijaga RLS/RPC di database. */
export function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const sb = createClient();
    sb.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return signedIn;
}
