// Pipeline ingest: ambil -> simpan mentah -> validasi -> upsert -> log. Idempoten.
import { createClient } from "npm:@supabase/supabase-js@2";

const UA = Deno.env.get("IDX_USER_AGENT") ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const IDX_BASE = Deno.env.get("IDX_BASE") ?? "https://www.idx.co.id/primary/TradingSummary";
const EP = { stock: "GetStockSummary", broker: "GetBrokerSummary", index: "GetIndexSummary" } as const;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const num = (v: unknown): number | null => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const pick = (r: Record<string, unknown>, keys: string[]) => { for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k]; return undefined; };
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchRetry(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let last: Response | Error | null = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, init);
      if (r.ok) return r;
      last = r;
      if (r.status === 403 || r.status === 404) break; // tidak ada gunanya mengulang
    } catch (e) { last = e as Error; }
    await sleep(800 * (i + 1) ** 2);
  }
  if (last instanceof Response) throw new Error(`HTTP ${last.status}`);
  throw last ?? new Error("fetch gagal");
}

const idxHeaders = { "User-Agent": UA, Accept: "application/json, text/plain, */*", Referer: "https://www.idx.co.id/", "Accept-Language": "id-ID,id;q=0.9" };

function weekdays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(from + "T00:00:00Z"); ymd(d) <= to; d = new Date(d.getTime() + 864e5)) {
    const dow = d.getUTCDay(); if (dow !== 0 && dow !== 6) out.push(ymd(d));
  }
  return out;
}

type SB = ReturnType<typeof createClient>;

async function upsertChunks(sb: SB, table: string, rows: unknown[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 500) as never, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function ingestIdxDay(sb: SB, dataset: keyof typeof EP, date: string, preloaded?: unknown) {
  const t0 = Date.now();
  const url = `${IDX_BASE}/${EP[dataset]}?length=9999&start=0&date=${date.replaceAll("-", "")}`;
  let status: "ok" | "partial" | "empty" | "error" = "ok"; let rowsIn = 0, rowsOk = 0, rejected = 0, message = "";
  try {
    const text = preloaded !== undefined ? JSON.stringify(preloaded) : await (await fetchRetry(url, { headers: idxHeaders })).text();
    let payload: { data?: Record<string, unknown>[] };
    try { payload = JSON.parse(text); } catch { throw new Error("Jawaban bukan JSON (kemungkinan diblokir): " + text.slice(0, 80)); }
    const data = payload.data ?? [];
    rowsIn = data.length;
    if (rowsIn === 0) { status = "empty"; message = "Tidak ada data (libur atau belum terbit)"; }
    else {
      await sb.from("raw_ingest").upsert({ source: `idx_${dataset}`, trade_date: date, payload, payload_hash: await sha256(text) }, { onConflict: "source,trade_date,payload_hash", ignoreDuplicates: true });
      const good: Record<string, unknown>[] = []; const bad: unknown[] = [];
      for (const r of data) {
        if (dataset === "stock") {
          const code = String(pick(r, ["StockCode", "Code"]) ?? "").trim();
          const close = num(pick(r, ["Close", "ClosePrice"])), prev = num(pick(r, ["Previous", "PreviousClose"]));
          const change = num(pick(r, ["Change"])) ?? (close !== null && prev !== null ? close - prev : null);
          const pct = prev && change !== null ? (change / prev) * 100 : 0;
          if (!/^[A-Z0-9]{2,8}$/.test(code) || close === null || close < 0) { bad.push({ reason: "kode/harga tidak valid", r }); continue; }
          if (Math.abs(pct) > 50) { bad.push({ reason: "perubahan > 50%", r }); continue; }
          good.push({ stock_code: code, trade_date: date, prev_close: prev, open_price: num(pick(r, ["OpenPrice", "Open"])), high: num(pick(r, ["High"])), low: num(pick(r, ["Low"])),
            close, change, change_pct: Number(pct.toFixed(4)), volume: Math.max(0, num(pick(r, ["Volume"])) ?? 0), value: Math.max(0, num(pick(r, ["Value"])) ?? 0),
            frequency: Math.max(0, num(pick(r, ["Frequency"])) ?? 0), bid: num(pick(r, ["Bid"])), offer: num(pick(r, ["Offer"])),
            foreign_buy: num(pick(r, ["ForeignBuy"])) ?? 0, foreign_sell: num(pick(r, ["ForeignSell"])) ?? 0, listed_shares: num(pick(r, ["ListedShares"])), source: "idx" });
        } else if (dataset === "broker") {
          const code = String(pick(r, ["IDFirm", "FirmCode", "Code"]) ?? "").trim();
          if (!/^[A-Z0-9]{2,4}$/.test(code)) { bad.push({ reason: "kode broker tidak valid", r }); continue; }
          good.push({ broker_code: code, trade_date: date, volume: num(pick(r, ["Volume"])) ?? 0, value: num(pick(r, ["Value"])) ?? 0, frequency: num(pick(r, ["Frequency"])) ?? 0, source: "idx" });
        } else {
          const code = String(pick(r, ["IndexCode", "Code"]) ?? "").trim();
          const close = num(pick(r, ["Close"]));
          if (!code || close === null) { bad.push({ reason: "indeks tidak valid", r }); continue; }
          const prev = num(pick(r, ["Previous"])); const change = num(pick(r, ["Change"])) ?? (prev !== null ? close - prev : null);
          good.push({ index_code: code, trade_date: date, prev_close: prev, open_price: null, high: num(pick(r, ["Highest", "High"])), low: num(pick(r, ["Lowest", "Low"])), close, change,
            change_pct: prev && change !== null ? Number(((change / prev) * 100).toFixed(4)) : null, volume: num(pick(r, ["Volume"])), value: num(pick(r, ["Value"])),
            frequency: num(pick(r, ["Frequency"])), market_cap: num(pick(r, ["MarketCapital", "MarketCap"])), source: "idx" });
        }
      }
      if (dataset === "stock") { // pastikan dimensi saham ada
        const dims = good.map((g) => { const raw = data.find((d) => String(pick(d, ["StockCode", "Code"])) === g.stock_code) ?? {}; return { code: g.stock_code, name: String(pick(raw, ["StockName", "Name"]) ?? g.stock_code), source: "idx" }; });
        await sb.from("dim_stock").upsert(dims, { onConflict: "code", ignoreDuplicates: true });
      }
      if (dataset === "broker") {
        const dims = good.map((g) => { const raw = data.find((d) => String(pick(d, ["IDFirm", "FirmCode", "Code"])) === g.broker_code) ?? {}; return { code: g.broker_code, name: String(pick(raw, ["FirmName", "Name"]) ?? g.broker_code) }; });
        await sb.from("dim_broker").upsert(dims, { onConflict: "code", ignoreDuplicates: true });
      }
      if (dataset === "index") {
        const dims = good.map((g) => ({ code: g.index_code, name: g.index_code === "COMPOSITE" ? "IHSG" : g.index_code, is_benchmark: g.index_code === "COMPOSITE" }));
        await sb.from("dim_index").upsert(dims, { onConflict: "code", ignoreDuplicates: true });
      }
      const table = dataset === "stock" ? "fact_stock_daily" : dataset === "broker" ? "fact_broker_daily" : "fact_index_daily";
      const key = dataset === "stock" ? "stock_code,trade_date" : dataset === "broker" ? "broker_code,trade_date" : "index_code,trade_date";
      await upsertChunks(sb, table, good, key);
      rowsOk = good.length; rejected = bad.length;
      if (bad.length) {
        await sb.from("quarantine").insert(bad.slice(0, 200).map((b) => ({ source: `idx_${dataset}`, trade_date: date, reason: (b as { reason: string }).reason, row_data: (b as { r: unknown }).r })));
        status = "partial"; message = `${bad.length} baris dikarantina`;
      }
    }
  } catch (e) { status = "error"; message = (e as Error).message; }
  await sb.from("ingest_log").insert({ source: `idx_${dataset}`, trade_date: date, status, rows_in: rowsIn, rows_ok: rowsOk, rows_rejected: rejected, duration_ms: Date.now() - t0, message });
  return { dataset, date, status, rows_in: rowsIn, rows_ok: rowsOk, rejected, message };
}

async function ingestYahoo(sb: SB, from: string, to: string, onlySymbols?: string[]) {
  const { data: syms } = await sb.from("dim_market_symbol").select("symbol,category").eq("active", true);
  const list = (syms ?? []).filter((s) => !onlySymbols || onlySymbols.includes(s.symbol as string));
  const results: unknown[] = [];
  for (const s of list) {
    const t0 = Date.now(); const symbol = s.symbol as string; let status: "ok" | "empty" | "error" = "ok"; let n = 0; let message = "";
    try {
      const p1 = Math.floor(new Date(from + "T00:00:00Z").getTime() / 1000), p2 = Math.floor(new Date(to + "T23:59:59Z").getTime() / 1000);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=history`;
      const res = await fetchRetry(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      const j = await res.json();
      const r = j?.chart?.result?.[0];
      const ts: number[] = r?.timestamp ?? []; const q = r?.indicators?.quote?.[0] ?? {};
      const rows: unknown[] = [];
      ts.forEach((t, i) => {
        const close = num(q.close?.[i]); if (close === null || close <= 0) return;
        const vol = num(q.volume?.[i]);
        const date = ymd(new Date((t + 7 * 3600) * 1000)); // tanggal WIB
        rows.push({ symbol, trade_date: date, close, volume: s.category === "proksi_id" ? vol : (vol && vol > 0 ? vol : null), source: "yahoo" });
      });
      if (!rows.length) { status = "empty"; message = "Tidak ada baris"; }
      else {
        await sb.from("raw_ingest").upsert({ source: `yahoo_${symbol}`, trade_date: to, payload: j, payload_hash: await sha256(JSON.stringify(j)) }, { onConflict: "source,trade_date,payload_hash", ignoreDuplicates: true });
        await upsertChunks(sb, "fact_market_daily", rows, "symbol,trade_date"); n = rows.length;
      }
    } catch (e) { status = "error"; message = (e as Error).message; }
    await sb.from("ingest_log").insert({ source: `yahoo_${symbol}`, trade_date: to, status, rows_in: n, rows_ok: n, duration_ms: Date.now() - t0, message });
    results.push({ symbol, status, rows: n, message });
    await sleep(400);
  }
  return results;
}

type YBar = { date: string; open: number | null; high: number | null; low: number | null; close: number; volume: number };

async function yahooBars(symbol: string, from: string, to: string): Promise<{ bars: YBar[]; name: string | null; raw: unknown }> {
  const p1 = Math.floor(new Date(from + "T00:00:00Z").getTime() / 1000), p2 = Math.floor(new Date(to + "T23:59:59Z").getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=history`;
  const res = await fetchRetry(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const j = await res.json();
  const r = j?.chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? []; const q = r?.indicators?.quote?.[0] ?? {};
  const bars: YBar[] = [];
  ts.forEach((t, i) => {
    const close = num(q.close?.[i]); if (close === null || close <= 0) return;
    bars.push({ date: ymd(new Date((t + 7 * 3600) * 1000)), open: num(q.open?.[i]), high: num(q.high?.[i]), low: num(q.low?.[i]), close, volume: Math.max(0, Math.round(num(q.volume?.[i]) ?? 0)) });
  });
  return { bars, name: (r?.meta?.longName ?? r?.meta?.shortName ?? null) as string | null, raw: j };
}

/** Saham IDX dari Yahoo (kode.JK). Hanya OHLC + volume; nilai transaksi = close x volume (perkiraan); frekuensi dan asing tidak tersedia. */
async function ingestYahooStocks(sb: SB, from: string, to: string, items: { code: string; sector?: string }[]) {
  const out: unknown[] = [];
  const queue = items.slice(0, 40);
  const worker = async () => {
    for (let it = queue.shift(); it; it = queue.shift()) {
      const t0 = Date.now(); const code = it.code.toUpperCase(); let status: "ok" | "empty" | "error" = "ok"; let n = 0; let message = "";
      try {
        if (!/^[A-Z0-9]{2,8}$/.test(code)) throw new Error("kode tidak valid");
        const { bars, name } = await yahooBars(`${code}.JK`, from, to);
        // hari tanpa transaksi (volume 0) dilewati; perubahan dihitung terhadap penutupan hari bursa sebelumnya
        const traded = bars.filter((b) => b.volume > 0);
        if (!traded.length) { status = "empty"; message = "Tidak ada baris"; }
        else {
          // bar pertama hanya jadi acuan penutupan sebelumnya (agar perubahan tidak tertimpa null saat pembaruan harian)
          const rows = traded.map((b, i) => {
            const prev = i > 0 ? traded[i - 1].close : null;
            return { stock_code: code, trade_date: b.date, prev_close: prev, open_price: b.open, high: b.high, low: b.low, close: b.close,
              change: prev === null ? null : Number((b.close - prev).toFixed(2)), change_pct: prev === null ? null : Number(((b.close / prev - 1) * 100).toFixed(4)),
              volume: b.volume, value: Math.round(b.close * b.volume), frequency: 0, foreign_buy: 0, foreign_sell: 0, source: "yahoo" };
          }).slice(traded.length > 1 ? 1 : 0);
          const dim: Record<string, unknown> = { code, name: name ?? code, active: true, source: "yahoo" };
          if (it.sector) dim.sector = it.sector;
          await sb.from("dim_stock").upsert(dim, { onConflict: "code" });
          await upsertChunks(sb, "fact_stock_daily", rows, "stock_code,trade_date"); n = rows.length;
        }
      } catch (e) { status = "error"; message = (e as Error).message; }
      await sb.from("ingest_log").insert({ source: `yahoo_stock`, trade_date: to, status, rows_in: n, rows_ok: n, duration_ms: Date.now() - t0, message: `${code} ${message}`.trim() });
      out.push({ code, status, rows: n, message });
      await sleep(250);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return out;
}

/** IHSG (^JKSE) dari Yahoo menjadi indeks COMPOSITE. */
async function ingestYahooIndex(sb: SB, from: string, to: string) {
  const { bars, raw } = await yahooBars("^JKSE", from, to);
  const rows = bars.map((b, i) => {
    const prev = i > 0 ? bars[i - 1].close : null;
    return { index_code: "COMPOSITE", trade_date: b.date, prev_close: prev, open_price: b.open, high: b.high, low: b.low, close: b.close,
      change: prev === null ? null : Number((b.close - prev).toFixed(4)), change_pct: prev === null ? null : Number(((b.close / prev - 1) * 100).toFixed(4)),
      volume: b.volume || null, source: "yahoo" };
  }).slice(bars.length > 1 ? 1 : 0);
  if (rows.length) {
    await sb.from("raw_ingest").upsert({ source: "yahoo_^JKSE", trade_date: to, payload: raw, payload_hash: await sha256(JSON.stringify(raw)) }, { onConflict: "source,trade_date,payload_hash", ignoreDuplicates: true });
    await upsertChunks(sb, "fact_index_daily", rows, "index_code,trade_date");
  }
  await sb.from("ingest_log").insert({ source: "yahoo_index", trade_date: to, status: rows.length ? "ok" : "empty", rows_in: rows.length, rows_ok: rows.length });
  return { rows: rows.length, last: rows.at(-1)?.trade_date ?? null };
}

async function ingestIntraday(sb: SB) {
  const res = await fetchRetry("https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?range=1d&interval=5m", { headers: { "User-Agent": UA } });
  const j = await res.json(); const r = j?.chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? []; const c: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
  const rows = ts.map((t, i) => ({ ts: new Date(t * 1000).toISOString(), price: c[i] })).filter((x) => x.price !== null);
  if (rows.length) await upsertChunks(sb, "intraday_ihsg", rows, "ts");
  return { rows: rows.length };
}

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: ok } = await sb.rpc("pipeline_secret_ok", { p: req.headers.get("x-pipeline-secret") ?? "" });
  if (!ok) return json({ error: "unauthorized" }, 401);
  const b = await req.json().catch(() => ({}));
  const today = ymd(new Date(Date.now() + 7 * 3600 * 1000));
  const daysBack = Math.min(Math.max(Number(b.days_back ?? 5), 1), 400);
  const to: string = b.to ?? b.date ?? today;
  const from: string = b.from ?? b.date ?? ymd(new Date(new Date(to + "T00:00:00Z").getTime() - daysBack * 864e5));
  try {
    if (b.source === "yahoo") return json({ source: "yahoo", results: await ingestYahoo(sb, from, to, b.symbols) });
    if (b.source === "yahoo_stocks") return json({ source: "yahoo_stocks", results: await ingestYahooStocks(sb, from, to, b.items ?? []) });
    if (b.source === "yahoo_index") return json({ source: "yahoo_index", ...(await ingestYahooIndex(sb, from, to)) });
    if (b.source === "intraday") return json({ source: "intraday", ...(await ingestIntraday(sb)) });
    if (b.source === "idx_import") { // jalur 2/3: worker eksternal (ber-IP Indonesia) atau Postman mengirim jawaban mentah IDX
      const items: { dataset: keyof typeof EP; date: string; payload: unknown }[] = b.items ?? [];
      const out: unknown[] = [];
      for (const it of items.slice(0, 20)) out.push(await ingestIdxDay(sb, it.dataset, it.date, it.payload));
      return json({ source: "idx_import", results: out });
    }
    if (b.source === "idx") {
      const datasets: (keyof typeof EP)[] = b.datasets ?? ["stock", "index", "broker"];
      const days = weekdays(from, to).slice(-12); // maksimal 12 hari per panggilan (batas waktu fungsi)
      const out: unknown[] = [];
      for (const d of days) for (const ds of datasets) { out.push(await ingestIdxDay(sb, ds, d)); await sleep(600); }
      return json({ source: "idx", days: days.length, results: out });
    }
    return json({ error: "source harus idx | idx_import | yahoo | intraday" }, 400);
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});
