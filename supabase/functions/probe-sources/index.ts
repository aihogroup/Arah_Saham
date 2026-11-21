// Uji 30 menit (proposal bag. 4): apakah IDX & Yahoo menerima permintaan dari IP cloud Supabase? Tidak menulis ke database.
const UA = Deno.env.get("IDX_USER_AGENT") ?? "PostmanRuntime/7.43.0";
const IDX_BASE = Deno.env.get("IDX_BASE") ?? "https://www.idx.co.id/primary/TradingSummary";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { "Content-Type": "application/json" } });

async function probe(name: string, url: string, headers: Record<string, string>) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers });
    const text = await r.text();
    let rows: number | null = null; let sample: unknown = null;
    try {
      const j = JSON.parse(text);
      rows = Array.isArray(j?.data) ? j.data.length : Array.isArray(j?.chart?.result?.[0]?.timestamp) ? j.chart.result[0].timestamp.length : null;
      sample = Array.isArray(j?.data) ? Object.keys(j.data[0] ?? {}) : null;
    } catch { sample = text.slice(0, 120); }
    return { name, status: r.status, rows, fields: sample, ms: Date.now() - t0 };
  } catch (e) { return { name, status: 0, error: (e as Error).message, ms: Date.now() - t0 }; }
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  let date = u.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { // default: hari kerja terakhir
    const d = new Date(Date.now() - 864e5); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() - 1);
    date = d.toISOString().slice(0, 10);
  }
  const ymd = date.replaceAll("-", "");
  const h = { "User-Agent": UA, Accept: "application/json, text/plain, */*", Referer: "https://www.idx.co.id/" };
  const now = Math.floor(Date.now() / 1000);
  const results = await Promise.all([
    probe("idx_broker", `${IDX_BASE}/GetBrokerSummary?length=9999&start=0&date=${ymd}`, h),
    probe("idx_stock", `${IDX_BASE}/GetStockSummary?length=9999&start=0&date=${ymd}`, h),
    probe("idx_index", `${IDX_BASE}/GetIndexSummary?length=9999&start=0&date=${ymd}`, h),
    probe("yahoo_usdidr", `https://query1.finance.yahoo.com/v8/finance/chart/USDIDR%3DX?period1=${now - 864e5 * 10}&period2=${now}&interval=1d`, { "User-Agent": UA }),
    probe("yahoo_gspc", `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=${now - 864e5 * 10}&period2=${now}&interval=1d`, { "User-Agent": UA }),
  ]);
  return json({ date, user_agent: UA, results });
});
