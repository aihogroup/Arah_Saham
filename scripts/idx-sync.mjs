// Sinkron data resmi IDX (saham, indeks, broker) dari komputer ini ke Supabase.
// IDX memblokir server luar Indonesia (HTTP 403), jadi pengambilan dilakukan di sini lalu dikirim lewat jalur `idx_import`.
// Idempoten: aman dijalankan berulang. Kredensial dibaca dari .env.import (tidak ikut Git).
//
// Pakai:  node scripts/idx-sync.mjs                         -> 5 hari kerja terakhir sampai hari ini (WIB)
//         node scripts/idx-sync.mjs --from 2026-11-23 --to 2026-11-24
import fs from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logFile = path.join(root, "scripts", "idx-sync.log");
const say = (m) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); try { fs.appendFileSync(logFile, l + "\n"); } catch {} };

const env = Object.fromEntries(fs.readFileSync(path.join(root, ".env.import"), "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
if (!env.SUPABASE_URL || !env.PIPELINE_SECRET) { say("GAGAL: .env.import harus berisi SUPABASE_URL dan PIPELINE_SECRET"); process.exit(1); }

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const ymd = (d) => d.toISOString().slice(0, 10);
const todayWib = ymd(new Date(Date.now() + 7 * 3600e3));
const to = arg("to") ?? todayWib;
const from = arg("from") ?? ymd(new Date(Date.parse(to + "T00:00:00Z") - 6 * 864e5));
const days = [];
for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 864e5) { const d = new Date(t); if (d.getUTCDay() % 6) days.push(ymd(d)); }

const IDX = "https://www.idx.co.id/primary/TradingSummary";
const EP = { stock: "GetStockSummary", index: "GetIndexSummary", broker: "GetBrokerSummary" };
const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", Accept: "application/json, text/plain, */*", Referer: "https://www.idx.co.id/", "Accept-Language": "id-ID,id;q=0.9" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(fn, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) { try { return await fn(); } catch (e) { err = e; await sleep(1500 * (i + 1)); } }
  throw err;
}

// IDX (Cloudflare) menolak fetch bawaan Node karena sidik jari TLS-nya, tetapi menerima curl.exe bawaan Windows.
const curl = (url) => new Promise((resolve, reject) => {
  const args = ["-s", "-m", "60", "-w", "\n%{http_code}", ...Object.entries(headers).flatMap(([k, v]) => ["-H", `${k}: ${v}`]), url];
  execFile(process.platform === "win32" ? "curl.exe" : "curl", args, { maxBuffer: 64 * 1024 * 1024 }, (err, out) => {
    if (err) return reject(err);
    const i = out.lastIndexOf("\n"); const code = Number(out.slice(i + 1));
    code === 200 ? resolve(out.slice(0, i)) : reject(new Error(`IDX HTTP ${code}`));
  });
});

async function getIdx(dataset, date) {
  return retry(async () => JSON.parse(await curl(`${IDX}/${EP[dataset]}?length=9999&start=0&date=${date.replaceAll("-", "")}`)));
}

async function send(dataset, date, payload) {
  return retry(async () => {
    const r = await fetch(`${env.SUPABASE_URL}/functions/v1/ingest`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-pipeline-secret": env.PIPELINE_SECRET },
      body: JSON.stringify({ source: "idx_import", items: [{ dataset, date, payload }] }), signal: AbortSignal.timeout(120000),
    });
    if (!r.ok) throw new Error(`Supabase HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`);
    return (await r.json()).results?.[0];
  });
}

say(`Mulai: ${days.length} hari kerja (${from} s/d ${to})`);
let bad = 0, loaded = 0;
for (const date of days) {
  for (const dataset of Object.keys(EP)) {
    try {
      const payload = await getIdx(dataset, date);
      if (!payload?.data?.length) { say(`${date} ${dataset}: kosong (libur atau belum terbit)`); continue; }
      const res = await send(dataset, date, payload);
      loaded++;
      say(`${date} ${dataset}: ${res?.status ?? "?"} masuk=${res?.rows_ok ?? "?"}/${res?.rows_in ?? "?"} ditolak=${res?.rejected ?? 0}`);
    } catch (e) { bad++; say(`${date} ${dataset}: GAGAL ${e.message}`); }
    await sleep(700);
  }
}
say(`Selesai: ${loaded} set dimuat, ${bad} gagal`);
process.exit(bad ? 2 : 0);
