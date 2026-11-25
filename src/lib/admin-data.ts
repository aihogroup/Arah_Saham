/** Daftar set data yang dapat dijelajahi admin. Harus sama dengan daftar putih pada fungsi SQL `admin_data`. */
export type DataSet = { id: string; label: string; hint: string; dated: boolean };
export type DataGroup = { title: string; sets: DataSet[] };

export const DATA_GROUPS: DataGroup[] = [
  { title: "Pasar", sets: [
    { id: "saham", label: "Saham", hint: "Harga, volume, nilai, dan transaksi asing harian per saham. Cari berdasarkan kode.", dated: true },
    { id: "indeks_harian", label: "Indeks", hint: "Indeks IDX harian (IHSG, LQ45, dan lainnya). Cari berdasarkan kode indeks.", dated: true },
    { id: "broker", label: "Broker", hint: "Nilai, volume, dan frekuensi transaksi harian per broker. Cari berdasarkan kode broker.", dated: true },
  ] },
  { title: "Global", sets: [
    { id: "komoditas", label: "Komoditas", hint: "Harga penutupan harian komoditas (minyak, emas, dan lainnya).", dated: true },
    { id: "kurs", label: "Kurs", hint: "Nilai tukar mata uang harian.", dated: true },
    { id: "indeks_global", label: "Indeks global", hint: "Indeks bursa dunia harian.", dated: true },
    { id: "proksi_saham", label: "Proksi saham", hint: "ETF dan ADR yang dipakai sebagai pembanding saham Indonesia.", dated: true },
    { id: "proksi_id", label: "Proksi Indonesia", hint: "Proksi pasar Indonesia (misalnya ETF dan IHSG berjangka).", dated: true },
  ] },
  { title: "Referensi", sets: [
    { id: "emiten", label: "Emiten", hint: "Daftar saham: nama, sektor, papan, dan jumlah saham beredar.", dated: false },
    { id: "free_float", label: "Free float", hint: "Persentase free float per saham yang sudah tercatat.", dated: true },
    { id: "perubahan_indeks", label: "Perubahan indeks", hint: "Saham masuk dan keluar indeks beserta tanggal efektif.", dated: true },
    { id: "daftar_broker", label: "Daftar broker", hint: "Kode dan nama broker.", dated: false },
    { id: "daftar_indeks", label: "Daftar indeks", hint: "Indeks yang dikelola di aplikasi.", dated: false },
    { id: "daftar_simbol", label: "Daftar simbol global", hint: "Simbol komoditas, kurs, indeks global, dan proksi beserta kategorinya.", dated: false },
  ] },
  { title: "Analisis & sistem", sets: [
    { id: "skor_saham", label: "Skor saham", hint: "Skor harian hasil perhitungan per saham.", dated: true },
    { id: "prediksi_saham", label: "Prediksi saham", hint: "Prediksi arah per saham beserta tanggal pembuatan.", dated: true },
    { id: "breadth", label: "Breadth pasar", hint: "Jumlah saham naik, turun, dan nilai transaksi total per hari. Cari dengan awalan tanggal (2026-11).", dated: true },
    { id: "log_ingest", label: "Log pengambilan data", hint: "Riwayat pengambilan data dari sumber. Cari berdasarkan nama sumber.", dated: true },
  ] },
];

export const ALL_SETS = DATA_GROUPS.flatMap((g) => g.sets);
export const findSet = (id: string | undefined) => ALL_SETS.find((s) => s.id === id) ?? ALL_SETS[0];

export type DataPage = { columns: string[]; rows: Record<string, unknown>[]; total: number; approx: boolean; limit: number; offset: number };
export const PAGE_SIZE = 50;
export const MAX_PAGE = 2000;

/** Tampilan satu sel: angka berformat Indonesia, tanggal apa adanya, boolean sebagai centang. */
export function cell(v: unknown): string {
  if (v === null || v === undefined) return "–";
  if (typeof v === "boolean") return v ? "ya" : "tidak";
  if (typeof v === "number") return v.toLocaleString("id-ID", { maximumFractionDigits: 6 });
  if (typeof v === "object") { const s = JSON.stringify(v); return s.length > 80 ? s.slice(0, 80) + "…" : s; }
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 19).replace("T", " ") : s;
}
