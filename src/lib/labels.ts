export const METRIC_LABEL: Record<string, string> = {
  value: "nilai transaksi",
  volume: "volume",
  frequency: "frekuensi",
  net_foreign: "net asing",
  mom: "momentum harga",
};

export const INDICATORS = [
  { id: "value", label: "Nilai transaksi", group: "Aliran dana" },
  { id: "volume", label: "Volume", group: "Aliran dana" },
  { id: "frequency", label: "Frekuensi", group: "Aliran dana" },
  { id: "net_foreign", label: "Net asing", group: "Asing" },
  { id: "mom", label: "Momentum (top gainer)", group: "Momentum" },
] as const;

export const PRESETS = [
  { name: "Seimbang", indicators: ["value", "volume", "frequency", "net_foreign", "mom"] },
  { name: "Aliran dana", indicators: ["value", "volume", "frequency"] },
  { name: "Asing", indicators: ["net_foreign"] },
] as const;

export const UNIVERSES = [
  { id: "IDX30", label: "IDX30" },
  { id: "LQ45", label: "LQ45" },
  { id: "IDX80", label: "IDX80" },
  { id: "SRI-KEHATI", label: "Kehati" },
  { id: "IDXHIDIV20", label: "High Div" },
  { id: "ALL", label: "Semua saham" },
] as const;

/** Alasan model dalam bahasa awam (rumus dan bobot tidak ditampilkan). [positif, negatif] */
export const FEATURE_REASON: Record<string, [string, string]> = {
  g_broker_value: ["Aliran nilai transaksi broker mendukung kenaikan", "Aliran nilai transaksi broker condong melemah"],
  g_broker_volume: ["Volume transaksi broker mendukung kenaikan", "Volume transaksi broker condong melemah"],
  g_broker_frequency: ["Frekuensi transaksi broker mendukung kenaikan", "Frekuensi transaksi broker condong melemah"],
  g_komoditas: ["Pergerakan komoditas biasanya sejalan dengan arah naik", "Pergerakan komoditas biasanya sejalan dengan arah turun"],
  g_kurs: ["Pergerakan kurs menguntungkan pasar saham", "Pergerakan kurs menekan pasar saham"],
  g_indeks_global: ["Bursa global kemarin mendukung pasar naik", "Bursa global kemarin menekan pasar"],
  g_proksi_id: ["Saham Indonesia di bursa luar negeri positif", "Saham Indonesia di bursa luar negeri melemah"],
  v_indeks_global: ["Bursa global yang biasanya searah IHSG sedang naik", "Bursa global yang biasanya searah IHSG sedang turun"],
  v_komoditas: ["Komoditas yang biasanya searah IHSG sedang menguat", "Komoditas yang biasanya searah IHSG sedang melemah"],
  v_kurs: ["Pergerakan kurs menguntungkan pasar saham", "Pergerakan kurs menekan pasar saham"],
  v_proksi_id: ["Saham Indonesia di bursa luar negeri positif", "Saham Indonesia di bursa luar negeri melemah"],
  v_proksi_saham: ["ETF dan ADR Indonesia di luar negeri menguat", "ETF dan ADR Indonesia di luar negeri melemah"],
  breadth_ratio: ["Lebih banyak saham naik daripada turun", "Lebih banyak saham turun daripada naik"],
  pct_above_ma20: ["Banyak saham berada di atas rata-rata 20 hari", "Sedikit saham berada di atas rata-rata 20 hari"],
  net_foreign_ratio: ["Investor asing cenderung membeli bersih", "Investor asing cenderung menjual bersih"],
  value_up_log: ["Nilai transaksi saham naik lebih besar dari yang turun", "Nilai transaksi saham turun lebih besar dari yang naik"],
  seas_dow: ["Pola hari dalam minggu cenderung positif", "Pola hari dalam minggu cenderung negatif"],
  seas_wom: ["Pola minggu dalam bulan cenderung positif", "Pola minggu dalam bulan cenderung negatif"],
  seas_month: ["Pola bulan ini cenderung positif", "Pola bulan ini cenderung negatif"],
  seas_yearend: ["Pola akhir tahun cenderung positif", "Pola akhir tahun cenderung negatif"],
  mom1: ["Momentum IHSG kemarin positif", "Momentum IHSG kemarin negatif"],
  mom5: ["Momentum IHSG 5 hari positif", "Momentum IHSG 5 hari negatif"],
  mom20: ["Momentum IHSG 20 hari positif", "Momentum IHSG 20 hari negatif"],
};

export const reasonText = (feature: string, contribution: number) =>
  (FEATURE_REASON[feature] ?? ["Kondisi data pasar mendukung kenaikan", "Kondisi data pasar condong menekan"])[contribution >= 0 ? 0 : 1];

export const DISCLAIMER =
  "Hasil adalah alat bantu analisis data, bukan ajakan membeli atau menjual saham dan bukan nasihat investasi.";
export const SITE_NAME = "ArahSaham.com";
