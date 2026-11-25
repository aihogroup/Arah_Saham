/** Peringkat saham: daftar metrik, bentuk baris, dan perhitungan rentang tanggal. Murni (tanpa efek samping) agar mudah diuji. */

export const METRICS = [
  { id: "gainer", label: "Top Gainer", col: "Perubahan", fmt: "pct" },
  { id: "loser", label: "Top Loser", col: "Perubahan", fmt: "pct" },
  { id: "value", label: "Top Value", col: "Nilai", fmt: "num" },
  { id: "volume", label: "Top Volume", col: "Volume", fmt: "num" },
  { id: "frequency", label: "Top Frekuensi", col: "Frekuensi", fmt: "num" },
  { id: "foreign_buy", label: "Asing Beli", col: "Asing beli", fmt: "num" },
  { id: "foreign_sell", label: "Asing Jual", col: "Asing jual", fmt: "num" },
  { id: "net_foreign_buy", label: "Net Asing Beli", col: "Net asing", fmt: "net" },
  { id: "net_foreign_sell", label: "Net Asing Jual", col: "Net asing", fmt: "net" },
  { id: "free_float", label: "Free Float Tertinggi", col: "Free float", fmt: "ff" },
  { id: "free_float_low", label: "Free Float Terendah", col: "Free float", fmt: "ff" },
] as const;
export type MetricId = (typeof METRICS)[number]["id"];
export const isMetric = (v: string | undefined): v is MetricId => METRICS.some((m) => m.id === v);
/** Nama lama `net_foreign` (tautan lama) dipetakan ke net asing beli. */
export const parseMetric = (v: string | undefined): MetricId => (v === "net_foreign" ? "net_foreign_buy" : isMetric(v) ? v : "gainer");

export type RankRow = {
  stock_code: string; name: string; sector: string | null; board: string | null; close: number; change_pct: number | null;
  value: number; volume: number; frequency: number; foreign_buy: number; foreign_sell: number; net_foreign: number;
  free_float_pct: number | null; days: number; from_date: string; to_date: string; spark: number[] | null;
};
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export function toRankRow(r: Record<string, unknown>): RankRow {
  return {
    stock_code: r.stock_code as string, name: r.name as string, sector: (r.sector as string) ?? null, board: (r.board as string) ?? null,
    close: Number(r.close), change_pct: num(r.change_pct), value: Number(r.value), volume: Number(r.volume), frequency: Number(r.frequency),
    foreign_buy: Number(r.foreign_buy), foreign_sell: Number(r.foreign_sell), net_foreign: Number(r.net_foreign), free_float_pct: num(r.free_float_pct),
    days: Number(r.days), from_date: r.from_date as string, to_date: r.to_date as string, spark: r.spark ? (r.spark as unknown[]).map(Number) : null,
  };
}

export type RankFilter = { metric: MetricId; board: string; sector: string; index: string; from: string; to: string };

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ms = (d: string) => Date.parse(d + "T00:00:00Z");
export const PRESETS = [
  { id: "last", label: "Terbaru" }, { id: "7d", label: "7 hari" }, { id: "30d", label: "30 hari" }, { id: "90d", label: "90 hari" }, { id: "ytd", label: "YTD" },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];

/** Rentang tanggal kalender yang berakhir pada hari data terakhir. "7 hari" = 7 hari kalender termasuk hari terakhir. */
export function presetRange(latest: string, id: PresetId): { from: string; to: string } {
  if (id === "last") return { from: "", to: "" };
  if (id === "ytd") return { from: `${latest.slice(0, 4)}-01-01`, to: latest };
  const n = id === "7d" ? 7 : id === "30d" ? 30 : 90;
  return { from: iso(ms(latest) - (n - 1) * 864e5), to: latest };
}
/** Preset yang cocok dengan rentang saat ini (untuk menandai tombol aktif); kosong bila rentang bebas. */
export function activePreset(latest: string, from: string, to: string): PresetId | null {
  if (!from && !to) return "last";
  for (const p of PRESETS) { const r = presetRange(latest, p.id); if (r.from === from && r.to === to) return p.id; }
  return null;
}
