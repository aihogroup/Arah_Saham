// Ridge multivariat (port dari tab Admin "ridge-model"): fungsi murni, tanpa database.
// Target     : % perubahan IHSG hari bursa berikutnya. Prediktor: intersep, `lags` return harian terakhir, dan semua faktor hari d.
// Pembakuan  : rata-rata dan simpangan baku dihitung SEKALI dari baris < T (periode latih awal), lalu dibekukan; dipotong di +-6; kosong = 0.
// Ridge      : w = (X'X + lambda_eff D)^-1 X'y, lambda_eff = lambda * (jumlah baris) / 1000; lambda dipilih dari {1..1e5} pada 15% akhir periode latih awal.
// Walk-forward: dilatih ulang tiap `refit` hari bursa memakai baris yang hasilnya sudah diketahui; ramalan hari d hanya memakai data sampai hari d.

export type Row = { date: string; close: number; td?: string | null; f: Record<string, number | null> };
export type Config = { testStart: string; lags: number; refit: number; minCover: number };

const LAMBDAS = [1, 10, 100, 1000, 1e4, 1e5];
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const clip = (v: number, c = 6) => Math.max(-c, Math.min(c, v));

function erf(x: number) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export const normCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

function solveRidge(XtX: number[][], Xty: number[], lambda: number): number[] {
  const p = Xty.length, A = XtX.map((r, i) => [...r.map((v, j) => (i === j && i > 0 ? v + lambda : v)), Xty[i]]);
  for (let c = 0; c < p; c++) {
    let m = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r;
    [A[c], A[m]] = [A[m], A[c]];
    const d = A[c][c] || 1e-12;
    for (let r = c + 1; r < p; r++) { const f = A[r][c] / d; if (f) for (let q = c; q <= p; q++) A[r][q] -= f * A[c][q]; }
  }
  const w = new Array(p).fill(0);
  for (let r = p - 1; r >= 0; r--) { let s = A[r][p]; for (let q = r + 1; q < p; q++) s -= A[r][q] * w[q]; w[r] = s / (A[r][r] || 1e-12); }
  return w;
}

export interface Fit { fit_date: string; n_rows: number; lambda: number; lambda_eff: number; intercept: number; resid_sd: number; coef: Record<string, number>; mean: Record<string, number>; sd: Record<string, number> }
export interface Fc { date: string; next_date: string | null; td: string | null; fit_date: string; pred_pct: number; prob_up: number; sigma: number; contrib: Record<string, number> }

export function runRidge(rows: Row[], cfg: Config) {
  const n = rows.length, L = cfg.lags;
  const keys = new Set<string>(); rows.forEach((r) => Object.keys(r.f).forEach((k) => keys.add(k)));
  const feats = [...keys].map((key) => ({ key, cover: rows.filter((r) => r.f[key] != null).length / (n || 1) })).filter((ft) => ft.cover >= cfg.minCover);
  const K = feats.length, P = 1 + L + K;
  const ret: number[] = rows.map((r, i) => (i ? (r.close / rows[i - 1].close - 1) * 100 : NaN));
  const y: (number | null)[] = rows.map((r, i) => (i < n - 1 ? (rows[i + 1].close / r.close - 1) * 100 : null));
  const first = L;
  const T = rows.findIndex((r) => r.date >= cfg.testStart);
  if (T < first + 250 || T >= n) throw new Error(`periode latih awal tidak valid (T=${T}, n=${n})`);

  const fMean: number[] = [], fSd: number[] = [];
  feats.forEach((ft) => {
    const v: number[] = [];
    for (let i = 0; i < T; i++) { const x = rows[i].f[ft.key]; if (x != null) v.push(Number(x)); }
    const m = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    const s = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)) : 1;
    fMean.push(m); fSd.push(s || 1);
  });
  const rv = ret.slice(1, T), rMean = rv.reduce((a, b) => a + b, 0) / rv.length;
  const rSd = Math.sqrt(rv.reduce((a, b) => a + (b - rMean) ** 2, 0) / (rv.length - 1)) || 1;
  const zr = ret.map((v) => (Number.isFinite(v) ? clip((v - rMean) / rSd) : 0));
  const zf = (i: number) => feats.map((ft, k) => { const x = rows[i].f[ft.key]; return x == null ? 0 : clip((Number(x) - fMean[k]) / fSd[k]); });
  const design = (i: number) => { const z = zf(i); const x = [1]; for (let l = 0; l < L; l++) x.push(zr[i - l]); return { x: [...x, ...z], z }; };
  const X: number[][] = [];
  const xs = (i: number) => (X[i] ??= design(i).x);

  const zero = () => ({ G: Array.from({ length: P }, () => new Array(P).fill(0)), g: new Array(P).fill(0), yty: 0, m: 0 });
  const add = (a: ReturnType<typeof zero>, i: number) => {
    const x = xs(i), t = y[i]!;
    for (let p = 0; p < P; p++) { a.g[p] += x[p] * t; const Gp = a.G[p], xp = x[p]; for (let q = 0; q < P; q++) Gp[q] += xp * x[q]; }
    a.yty += t * t; a.m++;
  };
  const dot = (w: number[], x: number[]) => { let s = 0; for (let p = 0; p < P; p++) s += w[p] * x[p]; return s; };

  const cut = first + Math.floor((T - first) * 0.85);
  const A0 = zero(); for (let i = first; i < cut; i++) add(A0, i);
  let lambda = LAMBDAS[0], best = Infinity;
  for (const lam of LAMBDAS) {
    const w = solveRidge(A0.G, A0.g, (lam * (cut - first)) / 1000);
    let s = 0; for (let i = cut; i < T; i++) s += (y[i]! - dot(w, xs(i))) ** 2;
    if (s < best) { best = s; lambda = lam; }
  }

  const acc = zero(); let used = first, w: number[] = [], sigma = 1, fitDate = "";
  const fits: Fit[] = [], fc: Fc[] = [];
  for (let i = T; i < n; i++) {
    if (!w.length || (i - T) % cfg.refit === 0 || i === n - 1) {
      for (; used < i; used++) add(acc, used);
      const lamEff = (lambda * (i - first)) / 1000;
      w = solveRidge(acc.G, acc.g, lamEff);
      let wGw = 0; for (let p = 0; p < P; p++) { let s = 0; for (let q = 0; q < P; q++) s += acc.G[p][q] * w[q]; wGw += w[p] * s; }
      let wXy = 0; for (let p = 0; p < P; p++) wXy += w[p] * acc.g[p];
      sigma = Math.sqrt(Math.max(acc.yty - 2 * wXy + wGw, 1e-9) / Math.max(acc.m - P, 1));
      fitDate = rows[i].date;
      const coef: Record<string, number> = {}, mean: Record<string, number> = {}, sd: Record<string, number> = {};
      for (let l = 0; l < L; l++) { coef[`lag${l + 1}`] = r6(w[1 + l]); mean[`lag${l + 1}`] = r6(rMean); sd[`lag${l + 1}`] = r6(rSd); }
      feats.forEach((ft, k) => { coef[ft.key] = r6(w[1 + L + k]); mean[ft.key] = r6(fMean[k]); sd[ft.key] = r6(fSd[k]); });
      fits.push({ fit_date: fitDate, n_rows: acc.m, lambda, lambda_eff: r6(lamEff), intercept: r6(w[0]), resid_sd: r6(sigma), coef, mean, sd });
    }
    const { x, z } = design(i);
    const pred = dot(w, x);
    const contrib: Record<string, number> = {};
    for (let l = 0; l < L; l++) contrib[`lag${l + 1}`] = w[1 + l] * x[1 + l];
    feats.forEach((ft, k) => { contrib[ft.key] = w[1 + L + k] * z[k]; });
    fc.push({ date: rows[i].date, next_date: i < n - 1 ? rows[i + 1].date : null, td: rows[i].td ?? null, fit_date: fitDate, pred_pct: pred, prob_up: normCdf(pred / sigma), sigma, contrib });
  }
  return { fits, forecasts: fc, meta: { lambda, n_features: K, train_end: rows[T].date, n_rows: n } };
}
