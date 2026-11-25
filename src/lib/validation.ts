// Validasi dan normalisasi masukan pengguna (satu tempat, dipakai semua formulir).
// Hukum Postel: terima masukan dengan longgar (spasi, huruf besar, koma desimal), kirim ke server dalam bentuk baku.
// Validasi di sini hanya untuk umpan balik cepat; server (RLS/RPC) tetap menjadi penjaga akhir.

export const normalize = {
  email: (v: string) => v.trim().toLowerCase(),
  username: (v: string) => v.trim().replace(/\s+/g, "_"),
  /** Kode saham: "bbca ", "BBCA.JK", "$bbca" → "BBCA". */
  stockCode: (v: string) => v.trim().toUpperCase().replace(/^\$/, "").replace(/\.JK$/, "").replace(/[^A-Z0-9]/g, ""),
  /** Angka gaya Indonesia atau internasional: "1.250,5" / "1,250.5" / "1250,5" → 1250.5. */
  number: (v: string): number => {
    const s = v.trim().replace(/\s|Rp/gi, "");
    if (!s) return Number.NaN;
    const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousands = decimalSep === "," ? /\./g : /,/g;
    return Number(s.replace(thousands, "").replace(",", "."));
  },
};

export type Rule = (v: string) => string | null;

export const rules = {
  required: (label: string): Rule => (v) => (v.trim() ? null : `${label} wajib diisi.`),
  email: (): Rule => (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalize.email(v)) ? null : "Format email belum benar, contoh: nama@email.com."),
  minLength: (n: number, label: string): Rule => (v) => (v.length >= n ? null : `${label} minimal ${n} karakter.`),
  username: (): Rule => (v) => (/^[A-Za-z0-9_]{3,24}$/.test(normalize.username(v)) ? null : "3–24 karakter: huruf, angka, atau garis bawah."),
};

/** Jalankan aturan berurutan; kembalikan pesan galat pertama atau null. */
export function check(value: string, ...list: Rule[]): string | null {
  for (const r of list) { const m = r(value); if (m) return m; }
  return null;
}
