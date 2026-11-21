import { describe, expect, it } from "vitest";
import { DEFAULT_OPTS, normCdf, solveSPD, walkForwardRidge } from "../supabase/functions/_shared/ridge";

function rng(seed: number) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); }

describe("ridge walk-forward", () => {
  it("normCdf", () => { expect(normCdf(0)).toBeCloseTo(0.5, 4); expect(normCdf(1.96)).toBeCloseTo(0.975, 3); });
  it("solveSPD", () => {
    const x = solveSPD([[4, 1], [1, 3]], [1, 2]);
    expect(4 * x[0] + x[1]).toBeCloseTo(1, 6); expect(x[0] + 3 * x[1]).toBeCloseTo(2, 6);
  });
  it("tidak memakai data masa depan: ramalan hari t tidak berubah jika y setelah t diubah", () => {
    const r = rng(7); const p = 18, n = 160;
    const X = Array.from({ length: n }, () => Array.from({ length: p }, () => r() - 0.5));
    const y = X.map((row) => row[0] * 2 + (r() - 0.5) * 0.2);
    const y2 = y.map((v, i) => (i > 120 ? -v : v));
    const a = walkForwardRidge(X, y, DEFAULT_OPTS), b = walkForwardRidge(X, y2, DEFAULT_OPTS);
    for (let t = 0; t <= 121; t++) expect(a[t].pred).toBeCloseTo(b[t].pred, 10);
  });
  it("bawaan: tidak pernah netral setelah data latih cukup, keyakinan >= 50%", () => {
    const r = rng(3); const X = Array.from({ length: 150 }, () => Array.from({ length: 18 }, () => r() - 0.5));
    const y = X.map(() => (r() - 0.5) * 0.02);
    const out = walkForwardRidge(X, y).filter((o) => o.ready);
    expect(out.length).toBeGreaterThan(50);
    for (const o of out) { expect(o.direction).not.toBe("netral"); expect(o.confidence).toBeGreaterThanOrEqual(0.5); }
  });
  it("menemukan sinyal dan menetralkan derau", () => {
    const r = rng(11); const p = 18, n = 400;
    const X = Array.from({ length: n }, () => Array.from({ length: p }, () => r() - 0.5));
    const y = X.map((row) => row[0] * 3 + (r() - 0.5) * 0.3);
    const out = walkForwardRidge(X, y, { ...DEFAULT_OPTS, neutralConf: 0.55 }).slice(200);
    const hit = out.filter((o, i) => o.direction !== "netral" && (o.pred > 0) === (y[200 + i] > 0));
    const called = out.filter((o) => o.direction !== "netral");
    expect(hit.length / called.length).toBeGreaterThan(0.85);
  });
});
