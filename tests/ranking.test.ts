import { describe, expect, it } from "vitest";
import { METRICS, activePreset, parseMetric, presetRange, toRankRow } from "@/lib/ranking";

describe("ranking", () => {
  it("memetakan jenis lama dan menolak jenis tak dikenal", () => {
    expect(parseMetric("net_foreign")).toBe("net_foreign_buy");
    expect(parseMetric("volume")).toBe("volume");
    expect(parseMetric("ngawur")).toBe("gainer");
    expect(parseMetric(undefined)).toBe("gainer");
    expect(METRICS.length).toBe(11);
  });
  it("menghitung rentang preset berakhir pada hari data terakhir", () => {
    expect(presetRange("2026-11-20", "7d")).toEqual({ from: "2026-11-14", to: "2026-11-20" });
    expect(presetRange("2026-11-20", "30d").from).toBe("2026-10-22");
    expect(presetRange("2026-11-20", "ytd")).toEqual({ from: "2026-01-01", to: "2026-11-20" });
    expect(presetRange("2026-11-20", "last")).toEqual({ from: "", to: "" });
  });
  it("mengenali preset aktif", () => {
    expect(activePreset("2026-11-20", "", "")).toBe("last");
    expect(activePreset("2026-11-20", "2026-11-14", "2026-11-20")).toBe("7d");
    expect(activePreset("2026-11-20", "2026-11-16", "2026-11-18")).toBeNull();
  });
  it("mengubah baris RPC menjadi angka", () => {
    const r = toRankRow({ stock_code: "BBCA", name: "BCA", close: "5550", change_pct: "1.5", value: "10", volume: "20", frequency: "3", foreign_buy: "4", foreign_sell: "1", net_foreign: "3", free_float_pct: null, days: 3, from_date: "2026-11-16", to_date: "2026-11-18", spark: ["1", "2"] });
    expect(r.close).toBe(5550); expect(r.free_float_pct).toBeNull(); expect(r.spark).toEqual([1, 2]);
  });
});
