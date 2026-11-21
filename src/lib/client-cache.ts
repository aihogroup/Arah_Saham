/**
 * Cache sisi klien (memori) untuk panggilan Supabase/API dari browser.
 * - TTL: hasil dipakai ulang selama `ttlMs` sehingga pindah tab/ganti filter tidak memanggil server lagi.
 * - In-flight dedupe: beberapa komponen yang meminta kunci sama bersamaan hanya memicu satu panggilan.
 * - Stale-on-error: bila server gagal, hasil lama (bila ada) tetap ditampilkan.
 * - Hanya memori (bukan localStorage/sessionStorage): data per-pengguna tidak bocor antar akun di satu tab.
 * Kesalahan tidak pernah di-cache: `loader` harus melempar error agar hasil gagal tidak tersimpan.
 */
type Entry = { v: unknown; t: number };
const MAX_ENTRIES = 200;
const mem = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, loader: () => Promise<T>, ttlMs = 5 * 60_000): Promise<T> {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = loader()
    .then((v) => {
      if (mem.size >= MAX_ENTRIES) mem.delete(mem.keys().next().value as string);
      mem.set(key, { v, t: Date.now() });
      return v;
    })
    .catch((e) => {
      if (hit) return hit.v as T; // stale-on-error
      throw e;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Hapus entri yang kuncinya diawali `prefix` (tanpa argumen: semua). */
export function invalidate(prefix = "") {
  for (const k of [...mem.keys()]) if (k.startsWith(prefix)) mem.delete(k);
}

/**
 * Ambil hasil `rpc()` yang bisa lebih dari batas 1000 baris per permintaan PostgREST dengan menyambung halaman (`.range`).
 * Fungsi RPC harus mengurutkan hasilnya secara deterministik.
 */
export async function rpcPaged<T>(make: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>, page = 1000, maxPages = 40): Promise<T[]> {
  const all: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const part = await rpcData<T[]>(make(i * page, i * page + page - 1));
    all.push(...(part ?? []));
    if (!part || part.length < page) break;
  }
  return all;
}

/** Bungkus hasil `rpc()` Supabase: lempar error agar tidak di-cache, kembalikan data (tidak pernah null untuk daftar). */
export async function rpcData<T>(call: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await call;
  if (error) throw new Error(error.message);
  return data as T;
}
