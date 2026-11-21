// Memindahkan data saham IDX dari Supabase LOKAL (aplikasi Admin, port 54322) ke Supabase Arah Saham (cloud).
// Pakai:  node scripts/impor-saham-lokal.mjs [--kering] [--sejak 2020-01-02] [--sampai 2026-12-31]
// Prasyarat: SUPABASE_SERVICE_ROLE_KEY terisi di .env.local; psql terpasang (PostgreSQL 18 / pgAdmin); Supabase lokal menyala.
// Aman diulang: upsert berdasarkan (stock_code, trade_date); baris IDX menimpa baris Yahoo (estimasi) pada tanggal yang sama.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const KERING = process.argv.includes("--kering");
const SEJAK = arg("--sejak", "2020-01-02");
const SAMPAI = arg("--sampai", "2099-12-31");

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!KERING && (!URL || !KEY)) { console.error("SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local (Supabase > Project Settings > API > service_role)."); process.exit(1); }

const PSQL = process.env.PSQL ?? ["C:/Program Files/PostgreSQL/18/bin/psql.exe", "C:/Program Files/PostgreSQL/17/bin/psql.exe", "C:/Program Files/PostgreSQL/16/bin/psql.exe"].find(existsSync) ?? "psql";
const sql = (q) => execFileSync(PSQL, ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-At", "-c", q], { env: { ...process.env, PGPASSWORD: "postgres" }, maxBuffer: 1 << 30, encoding: "utf8" }).trim();

async function post(table, rows, { conflict, ignore = false, columns } = {}) {
  for (let i = 0; i < rows.length; i += 4000) {
    const q = new globalThis.URLSearchParams({ on_conflict: conflict }); if (columns) q.set("columns", columns);
    const res = await fetch(`${URL}/rest/v1/${table}?${q}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: `resolution=${ignore ? "ignore" : "merge"}-duplicates,return=minimal` },
      body: JSON.stringify(rows.slice(i, i + 4000)),
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

// 1) dim_stock — kode baru ditambahkan; saham lama hanya diperbarui kolom yang tersedia (sektor lama dipertahankan bila lokal kosong)
const stocks = JSON.parse(sql(`select coalesce(json_agg(t),'[]') from (
  select s.stock_code code, coalesce(nullif(trim(s.stock_name),''), s.stock_code) name, nullif(trim(s.sector),'') sector, nullif(trim(s.board),'') board,
         s.listed_shares, (m.last >= (select max(date) from stock_daily) - 30) active, 'idx' source
  from stocks s join (select stock_code, max(date) last from stock_daily group by 1) m using (stock_code)
  where s.stock_code ~ '^[A-Z0-9]{2,8}$') t`));
console.log(`Saham: ${stocks.length} kode (aktif ${stocks.filter((s) => s.active).length})`);
if (!KERING) {
  await post("dim_stock", stocks.filter((s) => s.sector).map(({ code, name, sector, board, listed_shares, active, source }) => ({ code, name, sector, board, listed_shares, active, source })), { conflict: "code" });
  await post("dim_stock", stocks.filter((s) => !s.sector).map(({ code, name, board, listed_shares, active, source }) => ({ code, name, board, listed_shares, active, source })), { conflict: "code", columns: "code,name,board,listed_shares,active,source" });
}
const known = new Set(stocks.map((s) => s.code));

// 2) fact_stock_daily — per kuartal agar memori kecil
const range = sql(`select min(date)||'|'||max(date) from stock_daily where date between '${SEJAK}' and '${SAMPAI}'`).split("|");
let total = 0;
const start = new Date(range[0] + "T00:00:00Z"), end = new Date(range[1] + "T00:00:00Z");
for (let d = new Date(Date.UTC(start.getUTCFullYear(), Math.floor(start.getUTCMonth() / 3) * 3, 1)); d <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1))) {
  const a = d.toISOString().slice(0, 10), b = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 0)).toISOString().slice(0, 10);
  const rows = JSON.parse(sql(`select coalesce(json_agg(t),'[]') from (
    select stock_code, date trade_date, nullif(previous,0) prev_close, coalesce(nullif(open,0), nullif(first_trade,0)) open_price,
           nullif(high,0) high, nullif(low,0) low, close, change, case when previous > 0 then round(change/previous*100, 4) end change_pct,
           coalesce(volume,0) volume, coalesce(value,0)::numeric(22,0) value, coalesce(frequency,0) frequency, nullif(bid,0) bid, nullif(offer,0) offer,
           coalesce(foreign_buy,0) foreign_buy, coalesce(foreign_sell,0) foreign_sell, 'idx' source
    from stock_daily where date between greatest('${a}'::date,'${SEJAK}') and least('${b}'::date,'${SAMPAI}') and close >= 0 and stock_code ~ '^[A-Z0-9]{2,8}$') t`)).filter((r) => known.has(r.stock_code));
  if (!rows.length) continue;
  total += rows.length;
  console.log(`${a}..${b}: ${rows.length} baris`);
  if (!KERING) await post("fact_stock_daily", rows, { conflict: "stock_code,trade_date" });
}
// 3) IHSG (COMPOSITE) dari ihsg_daily lokal, agar skor & model bisa dihitung sejak awal data saham
const ih = JSON.parse(sql(`select coalesce(json_agg(t),'[]') from (
  select 'COMPOSITE' index_code, date trade_date, nullif(lag(close) over (order by date),0) prev_close, nullif(open,0) open_price, nullif(high,0) high, nullif(low,0) low, close,
         close - lag(close) over (order by date) change, round((close/nullif(lag(close) over (order by date),0)-1)*100, 4) change_pct, 'idx' source
  from ihsg_daily where date >= '${SEJAK}'::date - 10 and close > 0 order by date) t where trade_date between '${SEJAK}' and '${SAMPAI}'`));
console.log(`IHSG: ${ih.length} hari`);
if (!KERING) await post("fact_index_daily", ih, { conflict: "index_code,trade_date" });
// 4) Broker: dim_broker + fact_broker_daily (value, volume, frekuensi per broker per hari)
const brokers = JSON.parse(sql(`select coalesce(json_agg(t),'[]') from (select broker_code code, coalesce(nullif(trim(broker_name),''), broker_code) name, true active from broker where broker_code ~ '^[A-Z0-9]{2,4}$') t`));
if (!KERING) await post("dim_broker", brokers, { conflict: "code" });
const bset = new Set(brokers.map((b) => b.code));
const bro = JSON.parse(sql(`select coalesce(json_agg(t),'[]') from (select broker_code, date trade_date, coalesce(volume,0) volume, coalesce(value,0)::numeric(22,0) value, coalesce(frequency,0) frequency, 'idx' source
  from broker_daily where date between '${SEJAK}' and '${SAMPAI}' and coalesce(value,0) >= 0 and coalesce(volume,0) >= 0 and coalesce(frequency,0) >= 0) t`)).filter((r) => bset.has(r.broker_code));
console.log(`Broker: ${brokers.length} broker, ${bro.length} baris`);
if (!KERING) await post("fact_broker_daily", bro, { conflict: "broker_code,trade_date" });
console.log(KERING ? `Uji kering selesai: ${total} baris siap diimpor.` : `Selesai: ${total} baris diimpor.`);
