// Konstanta dan tipe untuk Beranda Premium (preferensi investasi, jurnal, rekomendasi personal).

export type DataMode = "stabil" | "dinamis";
export type UniverseKind = "indeks" | "wishlist" | "semua";
export type BuyStyle = "dip" | "momentum" | "seimbang";

export type Prefs = {
  data_mode: DataMode;
  universe_kind: UniverseKind;
  indexes: string[];
  buy_style: BuyStyle;
  criteria: string[];
  lookback_days: 5 | 21 | 63;
  hold_days: 1 | 3 | 7 | 30;
  max_picks: number;
};

export const DEFAULT_PREFS: Prefs = {
  data_mode: "stabil", universe_kind: "indeks", indexes: ["LQ45"], buy_style: "seimbang",
  criteria: ["value", "volume", "free_float"], lookback_days: 21, hold_days: 7, max_picks: 5,
};

export const INDEX_OPTIONS = [
  ["IDX30", "IDX30"], ["LQ45", "LQ45"], ["IDX80", "IDX80"], ["KOMPAS100", "KOMPAS100"], ["IDXHIDIV20", "High Dividend 20"],
  ["SRI-KEHATI", "SRI-KEHATI"], ["JII", "JII"], ["INFOBANK15", "Infobank15"], ["IDXBUMN20", "BUMN20"], ["IDXV30", "Value30"], ["IDXG30", "Growth30"], ["BISNIS-27", "Bisnis-27"],
] as const;

export const CRITERIA = [
  { id: "value", label: "Nilai transaksi terbesar", why: "Nilai transaksi besar" },
  { id: "volume", label: "Volume terbesar", why: "Volume besar" },
  { id: "freq_high", label: "Frekuensi tertinggi", why: "Frekuensi tinggi" },
  { id: "freq_low", label: "Frekuensi terendah", why: "Frekuensi rendah (lebih tenang)" },
  { id: "foreign_buy", label: "Net asing beli terbesar", why: "Asing net beli" },
  { id: "foreign_sell", label: "Net asing jual terbesar", why: "Asing net jual (pendekatan kontrarian)" },
  { id: "gainer", label: "Top gainer", why: "Kenaikan terkuat" },
  { id: "loser", label: "Top loser", why: "Penurunan terdalam" },
  { id: "free_float", label: "Free float terbesar", why: "Free float besar" },
] as const;
export const WHY: Record<string, string> = Object.fromEntries(CRITERIA.map((c) => [c.id, c.why]));

export const LOOKBACKS = [
  [5, "1 minggu", "Sentimen sangat singkat, cepat berubah"],
  [21, "1 bulan", "Sentimen menengah, seimbang"],
  [63, "3 bulan", "Sentimen luas, lebih tenang"],
] as const;
export const HOLDS = [[1, "1 hari"], [3, "3 hari"], [7, "1 minggu"], [30, "1 bulan"]] as const;

export type Pick = {
  code: string; name: string; sector: string | null; close: number | null; change_pct: number | null; score: number; ret: number;
  value: number; volume: number; freq: number; net_foreign: number; free_float: number | null; pump: string | null;
  forecast: "naik" | "turun" | null; forecast_conf: number | null; action: "Beli" | "Beli kecil" | "Tunda"; why: string[];
};
export type Holding = {
  code: string; name: string; lots: number; avg_cost: number; close: number | null; change_pct: number | null; pnl_pct: number | null;
  weight: number | null; days: number | null; forecast: "naik" | "turun" | null; advice: "Tambah" | "Tahan" | "Kurangi" | "Ambil untung" | "Evaluasi"; reason: string;
};
export type Outlook = { made_on?: string; target_date: string; direction: "naik" | "turun"; confidence: number; mode?: DataMode; reasons?: { feature: string; contribution: number }[] } | null;
export type Home =
  | { needs_setup: true }
  | { needs_setup?: false; date: string; outlook: Outlook; risk: "konservatif" | "moderat" | "agresif"; prefs: Prefs; picks: Pick[]; holdings: Holding[]; realized: number; wishlist_count: number; stop_pct: number; tp_pct: number };

export type Trade = { id: string; stock_code: string; side: "buy" | "sell"; lots: number; price: number; traded_on: string; note: string | null; source: "manual" | "saldo_awal" | "rekomendasi"; created_at: string };

/** Nilai rupiah ringkas: 2,9 T / 350 M / 12 jt. */
export function rp(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  const a = Math.abs(n), s = n < 0 ? "−" : "";
  const f = (x: number) => x.toLocaleString("id-ID", { maximumFractionDigits: x >= 100 ? 0 : 1 });
  if (a >= 1e12) return `${s}Rp${f(a / 1e12)} T`;
  if (a >= 1e9) return `${s}Rp${f(a / 1e9)} M`;
  if (a >= 1e6) return `${s}Rp${f(a / 1e6)} jt`;
  return `${s}Rp${f(a)}`;
}

/** Porsi dana beli per saham (dalam persen): dibagi rata, dibatasi sesuai profil risiko; "Beli kecil" separuhnya. */
export function allocation(picks: Pick[], risk: "konservatif" | "moderat" | "agresif"): Map<string, number> {
  const act = picks.filter((p) => p.action !== "Tunda");
  const cap = risk === "konservatif" ? 20 : risk === "agresif" ? 35 : 25;
  const units = act.reduce((s, p) => s + (p.action === "Beli kecil" ? 0.5 : 1), 0);
  const m = new Map<string, number>();
  if (units === 0) return m;
  for (const p of act) m.set(p.code, Math.round(Math.min(cap, (100 / units) * (p.action === "Beli kecil" ? 0.5 : 1))));
  return m;
}
