import { describe, expect, it } from "vitest";
import { defaultInterval, INTERVALS, RANGES, parseYahoo, rangeChange, sma, validCombo, validSymbol, type Bar } from "@/lib/yahoo";

describe("yahoo: kombinasi rentang dan interval", () => {
  it("menolak kombinasi yang tidak didukung Yahoo", () => {
    expect(validCombo("1mo", "1m")).toBe(false);
    expect(validCombo("1d", "1m")).toBe(true);
    expect(validCombo("5y", "1h")).toBe(false);
    expect(validCombo("max", "1mo")).toBe(true);
  });
  it("interval bawaan selalu sah untuk setiap rentang", () => {
    for (const r of RANGES) expect(validCombo(r, defaultInterval(r))).toBe(true);
    expect(INTERVALS.length).toBe(8);
  });
  it("memvalidasi simbol", () => {
    for (const s of ["BBCA.JK", "^JKSE", "USDIDR=X", "DX-Y.NYB", "GC=F"]) expect(validSymbol(s)).toBe(true);
    for (const s of ["", "a/b", "http://x", "A B", "x".repeat(30)]) expect(validSymbol(s)).toBe(false);
  });
});

describe("yahoo: parseYahoo", () => {
  const raw = (ts: number[], close: (number | null)[]) => ({ chart: { result: [{ meta: { symbol: "BBCA.JK", currency: "IDR", gmtoffset: 25200, regularMarketPrice: 100, chartPreviousClose: 98 },
    timestamp: ts, indicators: { quote: [{ open: close, high: close, low: close, close, volume: close.map(() => 10) }] } }] } });
  it("menggeser waktu intraday ke zona bursa dan membuang batang kosong", () => {
    const p = parseYahoo(raw([1000, 1060, 1120], [10, null, 12]), true)!;
    expect(p.bars.map((b) => b.time)).toEqual([1000 + 25200, 1120 + 25200]);
    expect(p.price).toBe(100); expect(p.previousClose).toBe(98);
  });
  it("memakai tanggal setempat untuk data harian dan membuang duplikat tanggal", () => {
    const t = Date.UTC(2026, 10, 20, 2) / 1000; // 09:00 WIB 20 Nov 2026
    const p = parseYahoo(raw([t, t + 60], [10, 11]), false)!;
    expect(p.bars).toHaveLength(1); expect(p.bars[0].time).toBe("2026-11-20"); expect(p.bars[0].close).toBe(11);
  });
  it("mengembalikan null untuk jawaban tanpa data", () => {
    expect(parseYahoo({ chart: { result: null } }, false)).toBeNull();
  });
});

describe("yahoo: rangeChange dan sma", () => {
  const bar = (time: number, o: number, c: number): Bar => ({ time, open: o, high: Math.max(o, c), low: Math.min(o, c), close: c, volume: 1 });
  it("rentang 1 hari memakai penutupan sebelumnya, lainnya batang pertama", () => {
    const bars = [bar(1, 100, 101), bar(2, 101, 103)];
    expect(rangeChange(bars, "1d", 103, 100)!.pct).toBeCloseTo(3);
    expect(rangeChange(bars, "1mo", 103, 100)!.pct).toBeCloseTo((103 / 101 - 1) * 100);
    expect(rangeChange([], "1d", 1, 1)).toBeNull();
  });
  it("menghitung rata-rata bergerak", () => {
    const bars = [1, 2, 3, 4].map((c, i) => bar(i, c, c));
    expect(sma(bars, 2).map((x) => x.value)).toEqual([1.5, 2.5, 3.5]);
    expect(sma(bars, 5)).toEqual([]);
  });
});
