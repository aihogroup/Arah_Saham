// Ridge walk-forward versi hemat CPU (array bertipe, matriks kovarians dihitung sekali per langkah).
// Semantik sama dengan ridge.ts: pada hari t hanya memakai baris < t yang targetnya sudah diketahui.
export interface FastOpts { multipliers: number[]; minTrain: number }
export interface FastStep { ready: boolean; pred: number; sigma: number; confidence: number; direction: "naik" | "turun"; contrib: number[] }

export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** Selesaikan A x = rhs (A simetris positif-pasti, p x p, baris-utama). A dirusak. */
function cholSolve(A: Float64Array, rhs: Float64Array, p: number, out: Float64Array, z: Float64Array) {
  for (let i = 0; i < p; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i * p + j];
      for (let k = 0; k < j; k++) s -= A[i * p + k] * A[j * p + k];
      A[i * p + j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / A[j * p + j];
    }
  }
  for (let i = 0; i < p; i++) { let s = rhs[i]; for (let k = 0; k < i; k++) s -= A[i * p + k] * z[k]; z[i] = s / A[i * p + i]; }
  for (let i = p - 1; i >= 0; i--) { let s = z[i]; for (let k = i + 1; k < p; k++) s -= A[k * p + i] * out[k]; out[i] = s / A[i * p + i]; }
}

export function walkForwardFast(X: number[][], y: (number | null)[], o: FastOpts): FastStep[] {
  const N = X.length; const p = N ? X[0].length : 0; const L = o.multipliers.length;
  const sx = new Float64Array(p), sxy = new Float64Array(p), sxx = new Float64Array(p * p);
  const cum = new Float64Array(L); let nErr = 0, sy = 0, sy2 = 0, n = 0;
  let prev: Float64Array | null = null;
  const out: FastStep[] = [];
  const means = new Float64Array(p), stds = new Float64Array(p), z = new Float64Array(p), b = new Float64Array(p);
  const C = new Float64Array(p * p), A = new Float64Array(p * p), beta = new Float64Array(p), tmp = new Float64Array(p);
  const preds = new Float64Array(L); let bestBeta = new Float64Array(p);
  const none: FastStep = { ready: false, pred: 0, sigma: 0, confidence: 0.5, direction: "naik", contrib: [] };

  for (let t = 0; t < N; t++) {
    if (t >= 1 && y[t - 1] !== null) {
      const yt = y[t - 1] as number;
      if (prev) { for (let l = 0; l < L; l++) { const e = yt - prev[l]; cum[l] += e * e; } nErr++; }
      const x = X[t - 1]; n++; sy += yt; sy2 += yt * yt;
      for (let i = 0; i < p; i++) { sx[i] += x[i]; sxy[i] += x[i] * yt; for (let j = 0; j <= i; j++) sxx[i * p + j] += x[i] * x[j]; }
    }
    if (n < o.minTrain) { prev = null; out.push(none); continue; }
    for (let i = 0; i < p; i++) { means[i] = sx[i] / n; stds[i] = Math.sqrt(Math.max(sxx[i * p + i] / n - means[i] * means[i], 1e-12)); }
    const ybar = sy / n;
    for (let i = 0; i < p; i++) z[i] = (X[t][i] - means[i]) / stds[i];
    for (let i = 0; i < p; i++) {
      b[i] = (sxy[i] - n * means[i] * ybar) / stds[i];
      for (let j = 0; j <= i; j++) C[i * p + j] = (sxx[i * p + j] - n * means[i] * means[j]) / (stds[i] * stds[j]);
    }
    const cur = new Float64Array(L); const betas: Float64Array[] = [];
    for (let l = 0; l < L; l++) {
      A.set(C); const lam = o.multipliers[l] * n;
      for (let i = 0; i < p; i++) A[i * p + i] += lam;
      cholSolve(A, b, p, beta, tmp);
      let pr = ybar; for (let i = 0; i < p; i++) pr += beta[i] * z[i];
      cur[l] = pr; preds[l] = pr; betas.push(Float64Array.from(beta));
    }
    let best = Math.floor(L / 2);
    if (nErr > 0) { best = 0; for (let l = 1; l < L; l++) if (cum[l] < cum[best]) best = l; }
    bestBeta = betas[best];
    const sigma = nErr > 0 ? Math.sqrt(cum[best] / nErr) : Math.sqrt(Math.max(sy2 / n - ybar * ybar, 1e-12));
    const pred = cur[best]; const conf = normCdf(Math.abs(pred) / sigma);
    out.push({ ready: true, pred, sigma, confidence: conf, direction: pred >= 0 ? "naik" : "turun", contrib: Array.from(bestBeta, (bb, i) => bb * z[i]) });
    prev = cur;
  }
  return out;
}
