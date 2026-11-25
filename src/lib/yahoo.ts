/** Grafik Yahoo Finance: validasi parameter, kombinasi rentang/interval yang diizinkan Yahoo, dan penguraian jawaban. */

export const INTERVALS = ["1m", "5m", "15m", "30m", "1h", "1d", "1wk", "1mo"] as const;
export const RANGES = ["1d", "5d", "1mo", "3mo", "6mo", "ytd", "1y", "2y", "5y", "10y", "max"] as const;
export type Interval = (typeof INTERVALS)[number];
export type Range = (typeof RANGES)[number];

const RANGE_DAYS: Record<Range, number> = { "1d": 1, "5d": 5, "1mo": 31, "3mo": 93, "6mo": 186, ytd: 366, "1y": 366, "2y": 731, "5y": 1827, "10y": 3653, max: Infinity };
/** Batas rentang (hari) per interval menurut Yahoo: 1m maksimum 7 hari, 5–30m 60 hari, 1h 730 hari. */
const MAX_DAYS: Record<Interval, number> = { "1m": 7, "5m": 60, "15m": 60, "30m": 60, "1h": 730, "1d": Infinity, "1wk": Infinity, "1mo": Infinity };

export const isInterval = (v: string): v is Interval => (INTERVALS as readonly string[]).includes(v);
export const isRange = (v: string): v is Range => (RANGES as readonly string[]).includes(v);
export const isIntraday = (i: Interval) => i !== "1d" && i !== "1wk" && i !== "1mo";
export const validCombo = (r: Range, i: Interval) => RANGE_DAYS[r] <= MAX_DAYS[i];
/** Interval paling halus yang sah untuk suatu rentang (dipakai saat pengguna ganti rentang). */
export function defaultInterval(r: Range): Interval {
  return ({ "1d": "1m", "5d": "5m", "1mo": "30m", "3mo": "1h", "6mo": "1d", ytd: "1d", "1y": "1d", "2y": "1d", "5y": "1wk", "10y": "1wk", max: "1mo" } as Record<Range, Interval>)[r];
}
/** Simbol Yahoo yang wajar (huruf, angka, titik, ^, =, -). Mencegah proxy dipakai untuk URL sembarang. */
export const validSymbol = (s: string) => /^[A-Za-z0-9^][A-Za-z0-9.^=\-]{0,19}$/.test(s);

export type Bar = { time: number | string; open: number; high: number; low: number; close: number; volume: number };
export type ChartPayload = {
  symbol: string; currency: string | null; exchange: string | null; name: string | null; intraday: boolean;
  price: number | null; previousClose: number | null; marketTime: number | null; bars: Bar[];
};

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Ubah jawaban mentah Yahoo menjadi batang OHLCV. Waktu intraday digeser ke zona bursa agar sumbu menampilkan jam setempat (WIB). */
export function parseYahoo(j: unknown, intraday: boolean): ChartPayload | null {
  const r = (j as { chart?: { result?: { meta?: Record<string, unknown>; timestamp?: number[]; indicators?: { quote?: Record<string, (number | null)[]>[] } }[] } })?.chart?.result?.[0];
  if (!r?.timestamp || !r.indicators?.quote?.[0]) return null;
  const m = r.meta ?? {}; const q = r.indicators.quote[0]; const off = Number(m.gmtoffset ?? 0);
  const bars: Bar[] = [];
  r.timestamp.forEach((t, i) => {
    const c = q.close?.[i]; if (c === null || c === undefined || !isFinite(c) || c <= 0) return;
    const o = q.open?.[i] ?? c, h = q.high?.[i] ?? c, l = q.low?.[i] ?? c;
    const local = (t + off) * 1000; // detik UTC + selisih zona -> "jam dinding" bursa, dibaca sebagai UTC oleh grafik
    bars.push({ time: intraday ? t + off : ymd(local), open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c, volume: q.volume?.[i] ?? 0 });
  });
  // Hari yang sama dari dua batang (mis. batang terakhir yang sedang berjalan): pertahankan yang terakhir.
  const dedup = new Map<number | string, Bar>(); for (const b of bars) dedup.set(b.time, b);
  return {
    symbol: String(m.symbol ?? ""), currency: (m.currency as string) ?? null, exchange: (m.fullExchangeName as string) ?? null, name: (m.longName as string) ?? (m.shortName as string) ?? null,
    intraday, price: typeof m.regularMarketPrice === "number" ? m.regularMarketPrice : null,
    previousClose: typeof m.chartPreviousClose === "number" ? m.chartPreviousClose : typeof m.previousClose === "number" ? m.previousClose : null,
    marketTime: typeof m.regularMarketTime === "number" ? m.regularMarketTime : null, bars: [...dedup.values()],
  };
}

/**
 * Perubahan harga yang ditampilkan pada kepala grafik. Rentang 1 hari dibandingkan dengan penutupan sebelumnya
 * (chartPreviousClose Yahoo untuk rentang lain adalah penutupan sebelum awal rentang), rentang lain dengan penutupan batang pertama.
 */
export function rangeChange(bars: Bar[], range: Range, price: number | null, previousClose: number | null): { abs: number; pct: number } | null {
  if (bars.length === 0) return null;
  const last = price ?? bars[bars.length - 1].close;
  const ref = range === "1d" ? (previousClose ?? bars[0].open) : bars[0].close;
  if (!ref || !isFinite(ref) || !isFinite(last)) return null;
  return { abs: last - ref, pct: (last / ref - 1) * 100 };
}

/** Rata-rata bergerak sederhana; titik sebelum data cukup dilewati. */
export function sma(bars: Bar[], period: number): { time: number | string; value: number }[] {
  const out: { time: number | string; value: number }[] = []; let sum = 0;
  bars.forEach((b, i) => {
    sum += b.close; if (i >= period) sum -= bars[i - period].close;
    if (i >= period - 1) out.push({ time: b.time, value: sum / period });
  });
  return out;
}
