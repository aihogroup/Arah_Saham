import type { Key } from "@/lib/i18n";

/** Kategori pasar: slug URL, kunci database, dan kunci terjemahan. */
export const MARKET_CATS = [
  { slug: "komoditas", title: "Komoditas", db: "komoditas", k: "cat.komoditas", lead: "cat.komoditas.lead" },
  { slug: "kurs", title: "Kurs", db: "kurs", k: "cat.kurs", lead: "cat.kurs.lead" },
  { slug: "indeks-global", title: "Indeks global", db: "indeks_global", k: "cat.indeks_global", lead: "cat.indeks_global.lead" },
  { slug: "proksi-indonesia", title: "Proksi Indonesia", db: "proksi_id", k: "cat.proksi_id", lead: "cat.proksi_id.lead" },
] as const satisfies readonly { slug: string; title: string; db: string; k: Key; lead: Key }[];

export const catBySlug = (slug: string) => MARKET_CATS.find((c) => c.slug === slug);
export const catByDb = (db: string) => MARKET_CATS.find((c) => c.db === db);
export const symbolHref = (symbol: string) => `/pasar/simbol/${encodeURIComponent(symbol)}`;

/** Harga instrumen pasar: jumlah desimal menyesuaikan besaran (kurs ~1,09 butuh 4 desimal; IDR 18.260 tidak). */
export function mprice(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return "–";
  const n = Number(v), a = Math.abs(n);
  const d = a >= 10000 ? 0 : a >= 100 ? 2 : a >= 10 ? 3 : 4;
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: d === 0 ? 0 : Math.min(2, d), maximumFractionDigits: d }).format(n);
}

export type CatalogRow = {
  symbol: string; name: string; category: string; last_date: string; close: number; change_pct: number | null;
  chg_1w: number | null; chg_1m: number | null; chg_3m: number | null; chg_ytd: number | null; chg_1y: number | null;
  first_date: string | null; n_days: number; spark: number[] | null;
};
