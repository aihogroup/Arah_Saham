import { NextResponse, type NextRequest } from "next/server";
import { defaultInterval, isInterval, isIntraday, isRange, parseYahoo, validCombo, validSymbol } from "@/lib/yahoo";

const UA = "Mozilla/5.0 (compatible; ArahSaham/1.0)";
const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

/** Proxy grafik Yahoo Finance (browser tidak bisa memanggil Yahoo langsung karena CORS). Hanya simbol, rentang, dan interval yang tervalidasi. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const symbol = p.get("symbol") ?? ""; const range = p.get("range") ?? "1mo";
  if (!validSymbol(symbol) || !isRange(range)) return NextResponse.json({ error: "parameter tidak valid" }, { status: 400 });
  const interval = p.get("interval") ?? defaultInterval(range);
  if (!isInterval(interval) || !validCombo(range, interval)) return NextResponse.json({ error: "kombinasi rentang dan interval tidak didukung" }, { status: 400 });

  let lastErr = "";
  for (const host of HOSTS) {
    try {
      const res = await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%7Csplit`, {
        headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store",
      });
      if (!res.ok) { lastErr = `Yahoo ${res.status}`; continue; }
      const data = parseYahoo(await res.json(), isIntraday(interval));
      if (!data || data.bars.length === 0) return NextResponse.json({ error: "data tidak tersedia untuk simbol ini" }, { status: 404, headers: { "cache-control": "public, s-maxage=60" } });
      const ttl = isIntraday(interval) ? 15 : 300;
      return NextResponse.json({ ...data, range, interval }, { headers: { "cache-control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}` } });
    } catch (e) { lastErr = (e as Error).message; }
  }
  return NextResponse.json({ error: "Yahoo Finance tidak dapat dihubungi", detail: lastErr }, { status: 502, headers: { "cache-control": "no-store" } });
}
