// Pembatas laju sederhana per kunci (in-memory per instans). Untuk skala besar pindahkan ke Redis/Upstash.
const hits = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number } {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || e.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  e.n++;
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  return { ok: e.n <= limit, remaining: Math.max(0, limit - e.n) };
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/**
 * Pembatas laju terdistribusi (Postgres, atomik) untuk endpoint sensitif: berlaku lintas instans server.
 * Bila kunci service role belum ada atau database tidak terjangkau, jatuh kembali ke pembatas in-memory
 * (gagal-aman: tidak pernah memblokir semua pengguna karena gangguan penghitung).
 */
export async function rateLimitShared(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return rateLimit(key, limit, windowMs).ok;
  try {
    const { adminClient } = await import("@/lib/supabase/admin");
    const { data, error } = await adminClient().rpc("hit_rate_limit", { p_key: key, p_limit: limit, p_window_s: Math.ceil(windowMs / 1000) });
    if (error) throw error;
    return data === true;
  } catch {
    return rateLimit(key, limit, windowMs).ok;
  }
}
