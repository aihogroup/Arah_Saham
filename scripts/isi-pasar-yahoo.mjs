// Mengisi riwayat penuh harga penutupan komoditas, kurs, indeks global & proksi dari Yahoo Finance ke fact_market_daily.
// Pakai:  node scripts/isi-pasar-yahoo.mjs [SIMBOL ...]   (tanpa argumen = semua simbol aktif di dim_market_symbol)
// Aman diulang (upsert). Prasyarat: SUPABASE_SERVICE_ROLE_KEY di .env.local.
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ymd = (d) => d.toISOString().slice(0, 10);

const only = process.argv.slice(2);
const syms = await (await fetch(`${URL}/rest/v1/dim_market_symbol?select=symbol,category&active=eq.true`, { headers: H })).json();
const list = syms.filter((s) => !only.length || only.includes(s.symbol));

for (const s of list) {
  let j;
  for (let t = 0; t < 3 && !j; t++) {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.symbol)}?period1=0&period2=${Math.floor(Date.now() / 1000) + 86400}&interval=1d&events=history`, { headers: { "User-Agent": UA } });
    if (r.ok) j = await r.json(); else await sleep(1500 * (t + 1));
  }
  const r = j?.chart?.result?.[0];
  const ts = r?.timestamp ?? [], q = r?.indicators?.quote?.[0] ?? {};
  const byDate = new Map();
  ts.forEach((t, i) => {
    const close = q.close?.[i]; if (close == null || !(close > 0)) return;
    const vol = q.volume?.[i];
    byDate.set(ymd(new Date((t + 7 * 3600) * 1000)), { symbol: s.symbol, trade_date: ymd(new Date((t + 7 * 3600) * 1000)), close, volume: s.category === "proksi_id" ? (vol ?? null) : (vol > 0 ? vol : null), source: "yahoo" });
  });
  const rows = [...byDate.values()];
  if (!rows.length) { console.log(`${s.symbol}: TIDAK ADA DATA`); continue; }
  for (let i = 0; i < rows.length; i += 2000) {
    const res = await fetch(`${URL}/rest/v1/fact_market_daily?on_conflict=symbol,trade_date`, { method: "POST", headers: { ...H, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 2000)) });
    if (!res.ok) throw new Error(`${s.symbol}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  console.log(`${s.symbol}: ${rows.length} hari (${rows[0].trade_date} → ${rows.at(-1).trade_date})`);
  await sleep(500);
}
