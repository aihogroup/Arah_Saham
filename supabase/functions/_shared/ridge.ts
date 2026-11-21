// Ridge walk-forward: pada hari t hanya memakai baris < t yang targetnya sudah diketahui.
export const FEATURES = [
  "g_broker_value", "g_broker_volume", "g_broker_frequency", "g_komoditas", "g_kurs", "g_indeks_global", "g_proksi_id",
  "breadth_ratio", "pct_above_ma20", "net_foreign_ratio", "value_up_log",
  "seas_dow", "seas_wom", "seas_month", "seas_yearend", "mom1", "mom5", "mom20",
] as const;

export interface RidgeOptions { multipliers: number[]; minTrain: number; neutralConf: number }
// neutralConf = 0: ramalan selalu memilih naik atau turun (tidak ada keluaran netral). Keyakinan tetap ditampilkan jujur (>= 50%).
export const DEFAULT_OPTS: RidgeOptions = { multipliers: [0.01, 0.1, 1, 10, 100], minTrain: 60, neutralConf: 0 };

export interface RidgeStep {
  ready: boolean; pred: number; lambda: number; sigma: number; confidence: number;
  direction: "naik" | "turun" | "netral"; intercept: number; coefs: number[]; means: number[]; stds: number[];
  contrib: number[]; n: number;
}

export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

// Cholesky: selesaikan A b = rhs untuk A simetris positif-pasti
export function solveSPD(A: number[][], rhs: number[]): number[] {
  const p = rhs.length;
  const L: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-12));
      else L[i][j] = s / L[j][j];
    }
  }
  const z = new Array(p).fill(0);
  for (let i = 0; i < p; i++) { let s = rhs[i]; for (let k = 0; k < i; k++) s -= L[i][k] * z[k]; z[i] = s / L[i][i]; }
  const x = new Array(p).fill(0);
  for (let i = p - 1; i >= 0; i--) { let s = z[i]; for (let k = i + 1; k < p; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
  return x;
}

/** X[t] = fitur hari t; y[t] = return hari bursa berikutnya (null bila belum diketahui). */
export function walkForwardRidge(X: number[][], y: (number | null)[], opts: RidgeOptions = DEFAULT_OPTS): RidgeStep[] {
  const N = X.length; const p = N ? X[0].length : 0; const L = opts.multipliers.length;
  const sx = new Array(p).fill(0); const sxy = new Array(p).fill(0); let sy = 0; let n = 0;
  const sxx: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const cum = new Array(L).fill(0); let nErr = 0; let sy2 = 0;
  let prev: number[] | null = null;
  const out: RidgeStep[] = [];
  const empty: RidgeStep = { ready: false, pred: 0, lambda: 0, sigma: 0, confidence: 0.5, direction: "netral", intercept: 0, coefs: [], means: [], stds: [], contrib: [], n: 0 };

  for (let t = 0; t < N; t++) {
    if (t >= 1 && y[t - 1] !== null) {
      const yt = y[t - 1] as number;
      if (prev) { for (let l = 0; l < L; l++) { const e = yt - prev[l]; cum[l] += e * e; } nErr++; }
      const x = X[t - 1];
      n++; sy += yt; sy2 += yt * yt;
      for (let i = 0; i < p; i++) { sx[i] += x[i]; sxy[i] += x[i] * yt; for (let j = 0; j <= i; j++) sxx[i][j] += x[i] * x[j]; }
    }
    if (n < opts.minTrain) { prev = null; out.push({ ...empty, n }); continue; }
    const means = sx.map((v) => v / n);
    const stds = means.map((m, i) => Math.sqrt(Math.max(sxx[i][i] / n - m * m, 1e-12)));
    const ybar = sy / n;
    const z = X[t].map((v, i) => (v - means[i]) / stds[i]);
    const betas: number[][] = []; const preds: number[] = [];
    for (let l = 0; l < L; l++) {
      const lam = opts.multipliers[l] * n;
      const A: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
      for (let i = 0; i < p; i++) for (let j = 0; j <= i; j++) {
        const v = (sxx[i][j] - n * means[i] * means[j]) / (stds[i] * stds[j]);
        A[i][j] = v; A[j][i] = v;
      }
      for (let i = 0; i < p; i++) A[i][i] += lam;
      const b = sxy.map((v, i) => (v - n * means[i] * ybar) / stds[i]);
      const beta = solveSPD(A, b);
      betas.push(beta);
      let pr = ybar; for (let i = 0; i < p; i++) pr += beta[i] * z[i];
      preds.push(pr);
    }
    let best = Math.floor(L / 2);
    if (nErr > 0) { best = 0; for (let l = 1; l < L; l++) if (cum[l] < cum[best]) best = l; }
    const sigma = nErr > 0 ? Math.sqrt(cum[best] / nErr) : Math.sqrt(Math.max(sy2 / n - ybar * ybar, 1e-12));
    const pred = preds[best];
    const confidence = normCdf(Math.abs(pred) / sigma);
    const direction = confidence < opts.neutralConf ? "netral" : pred >= 0 ? "naik" : "turun";
    out.push({
      ready: true, pred, lambda: opts.multipliers[best], sigma, confidence, direction,
      intercept: ybar, coefs: betas[best], means, stds, contrib: betas[best].map((b, i) => b * z[i]), n,
    });
    prev = preds;
  }
  return out;
}
