// Uji beban ringan terhadap RPC publik Supabase (anon). Pakai: node scripts/uji-beban.mjs [konkurensi=50] [total=400]
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const C = Number(process.argv[2] ?? 50), N = Number(process.argv[3] ?? 400);
const calls = [["rankings", { p_kind: "gainer", p_limit: 10 }], ["rankings", { p_kind: "value", p_limit: 10 }], ["market_overview", {}], ["ihsg_series", { p_days: 21 }], ["pub_data_status", {}], ["stock_series", { p_code: "BBCA", p_days: 31 }]];
const lat = []; let fail = 0, next = 0;
async function worker() {
  while (next < N) {
    const i = next++; const [fn, body] = calls[i % calls.length]; const t = performance.now();
    try {
      const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await r.arrayBuffer(); if (!r.ok) fail++;
    } catch { fail++; }
    lat.push(performance.now() - t);
  }
}
const t0 = performance.now();
await Promise.all(Array.from({ length: C }, worker));
const s = (performance.now() - t0) / 1000; lat.sort((a, b) => a - b);
const q = (p) => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))].toFixed(0);
console.log(`konkurensi ${C}, ${N} permintaan, ${s.toFixed(1)} dtk, ${(N / s).toFixed(0)} req/dtk, gagal ${fail}`);
console.log(`latensi ms  p50 ${q(0.5)}  p95 ${q(0.95)}  p99 ${q(0.99)}  maks ${lat.at(-1).toFixed(0)}`);
