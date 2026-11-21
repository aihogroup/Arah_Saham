import { cacheLife, cacheTag } from "next/cache";
import { anonClient } from "@/lib/supabase/anon";
import type { CatalogRow } from "@/lib/market";
import { toGroupRow } from "@/lib/stocks";

/**
 * Pembaca data publik yang di-cache bersama (CDN/server). Hanya memakai klien anon: tidak ada data pribadi.
 * Pipeline memanggil /api/revalidate (tag "market") setelah data baru masuk; selebihnya kedaluwarsa tiap 5 menit.
 */
const LIFE = { stale: 300, revalidate: 300, expire: 86400 } as const;

export type Mover = {
  stock_code: string; name: string; sector: string | null; close: number; change_pct: number | null; value: number;
  volume: number; net_foreign: number | null; trade_date: string; spark: number[] | null;
};
export type Overview = {
  ihsg: { date: string; close: number; change_pct: number | null; prev_close: number | null; value: number | null } | null;
  ihsg_spark: number[];
  breadth: { trade_date: string; advancers: number; decliners: number; unchanged: number; total_value: number | null; pct_above_ma20: number | null } | null;
  others: { symbol: string; name: string; category: string; close: number; change_pct: number | null; spark: number[] }[];
};
export type DataStatus = { stock_date: string | null; index_date: string | null; broker_date: string | null; market_date: string | null; scored_date: string | null; complete: boolean; demo: boolean };

export async function getOverview(): Promise<Overview | null> {
  "use cache";
  cacheLife(LIFE); cacheTag("market");
  const { data } = await anonClient().rpc("market_overview");
  return (data as Overview) ?? null;
}

export async function getDataStatus(): Promise<DataStatus | null> {
  "use cache";
  cacheLife(LIFE); cacheTag("market");
  const { data } = await anonClient().rpc("pub_data_status");
  return (data as DataStatus) ?? null;
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Seluruh instrumen pasar (komoditas, kurs, indeks global, proksi) dengan kinerja berbagai periode. */
export async function getMarketCatalog(): Promise<CatalogRow[]> {
  "use cache";
  cacheLife(LIFE); cacheTag("market");
  const { data } = await anonClient().rpc("market_catalog");
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    symbol: r.symbol as string, name: r.name as string, category: r.category as string, last_date: r.last_date as string,
    close: Number(r.close), change_pct: n(r.change_pct), chg_1w: n(r.chg_1w), chg_1m: n(r.chg_1m), chg_3m: n(r.chg_3m), chg_ytd: n(r.chg_ytd), chg_1y: n(r.chg_1y),
    first_date: (r.first_date as string) ?? null, n_days: Number(r.n_days), spark: r.spark ? (r.spark as unknown[]).map(Number) : null,
  }));
}

export async function getMarketSeries(symbol: string, days: number): Promise<{ trade_date: string; close: number; change_pct: number | null }[]> {
  "use cache";
  cacheLife(LIFE); cacheTag("market");
  const { data } = await anonClient().rpc("market_series", { p_symbol: symbol, p_days: days });
  return ((data as { trade_date: string; close: number | string; change_pct: number | string | null }[]) ?? []).map((r) => ({ trade_date: r.trade_date, close: Number(r.close), change_pct: n(r.change_pct) }));
}

export type StockGroup = { grp: string; label: string; n: number; advancers: number; decliners: number; avg_change: number | null; total_value: number | null };

/** Ringkasan kelompok saham menurut sektor, papan, atau indeks. */
export async function getStockGroups(kind: "sektor" | "papan" | "indeks"): Promise<StockGroup[]> {
  "use cache";
  cacheLife(LIFE); cacheTag("market");
  const { data } = await anonClient().rpc("stock_groups", { p_kind: kind });
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    grp: r.grp as string, label: r.label as string, n: Number(r.n), advancers: Number(r.advancers), decliners: Number(r.decliners), avg_change: n(r.avg_change), total_value: n(r.total_value),
  }));
}

/** Anggota kelompok untuk pengunjung (10 teratas menurut nilai transaksi). */
export async function getGroupStocksPublic(kind: "sektor" | "papan" | "indeks", value: string) {
  "use cache";
  cacheLife(LIFE); cacheTag("market");
  const { data } = await anonClient().rpc("group_stocks", { p_kind: kind, p_value: value, p_limit: 10 });
  return ((data as Record<string, unknown>[]) ?? []).map(toGroupRow);
}

export async function getRanking(kind: "gainer" | "loser" | "value" | "net_foreign", limit = 10): Promise<Mover[]> {
  "use cache";
  cacheLife(LIFE); cacheTag("market");
  const { data } = await anonClient().rpc("rankings", { p_kind: kind, p_limit: limit });
  return ((data as Mover[]) ?? []).map(norm);
}

export async function getIhsgSeries(days = 31): Promise<{ trade_date: string; close: number; change_pct: number | null }[]> {
  "use cache";
  cacheLife(LIFE); cacheTag("market");
  const { data } = await anonClient().rpc("ihsg_series", { p_days: days });
  return ((data as { trade_date: string; close: number | string; change_pct: number | string | null }[]) ?? []).map((r) => ({
    trade_date: r.trade_date, close: Number(r.close), change_pct: r.change_pct === null ? null : Number(r.change_pct),
  }));
}

export async function getStockList(index: string | null = null, limit = 10) {
  "use cache";
  cacheLife(LIFE); cacheTag("market");
  const { data } = await anonClient().rpc("stock_table", { p_index: index, p_q: null, p_limit: limit, p_after: null });
  return ((data as Mover[]) ?? []).map(norm);
}

export async function getStock(code: string) {
  "use cache";
  cacheLife(LIFE); cacheTag("market");
  const sb = anonClient();
  const c = code.toUpperCase();
  const [{ data: s }, { data: series }, { data: memberships }, { data: changes }] = await Promise.all([
    sb.from("dim_stock").select("code,name,sector,board,listed_shares").eq("code", c).maybeSingle(),
    sb.rpc("stock_series", { p_code: c, p_days: 31 }),
    sb.from("index_members").select("version_id, index_versions!inner(index_code,effective_from,effective_to)").eq("stock_code", c).is("index_versions.effective_to", null),
    sb.from("index_changes").select("index_code,change_type,effective_date").eq("stock_code", c).eq("superseded", false).order("effective_date", { ascending: false }).limit(20),
  ]);
  const idx = ((memberships ?? []) as unknown as { index_versions: { index_code: string } | { index_code: string }[] }[])
    .map((m) => (Array.isArray(m.index_versions) ? m.index_versions[0]?.index_code : m.index_versions?.index_code)).filter(Boolean) as string[];
  return {
    stock: s as { code: string; name: string; sector: string | null; board: string | null; listed_shares: number | null } | null,
    series: ((series as { trade_date: string; close: number | string; volume: number; value: number | string; change_pct: number | string | null }[]) ?? []).map((r) => ({
      trade_date: r.trade_date, close: Number(r.close), volume: Number(r.volume), value: Number(r.value), change_pct: r.change_pct === null ? null : Number(r.change_pct),
    })),
    indexes: idx,
    changes: (changes ?? []) as { index_code: string; change_type: "in" | "out"; effective_date: string }[],
  };
}

export async function getStockCodes(limit = 30): Promise<string[]> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 }); cacheTag("market");
  const { data } = await anonClient().rpc("rankings", { p_kind: "value", p_limit: limit });
  return ((data as { stock_code: string }[]) ?? []).map((r) => r.stock_code);
}

export async function getIndexChanges(limit = 60) {
  "use cache";
  cacheLife(LIFE); cacheTag("market");
  const sb = anonClient();
  const [{ data: ch }, { data: idx }, { data: stocks }] = await Promise.all([
    sb.from("index_changes").select("index_code,stock_code,change_type,effective_date").eq("superseded", false).order("effective_date", { ascending: false }).limit(limit),
    sb.from("dim_index").select("code,name").order("sort_order"),
    sb.from("dim_stock").select("code,name"),
  ]);
  const names = Object.fromEntries((stocks ?? []).map((s) => [s.code, s.name]));
  return { changes: (ch ?? []).map((c) => ({ ...c, name: names[c.stock_code] ?? c.stock_code })), indexes: idx ?? [] };
}

export async function getPosts(limit = 20) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 }); cacheTag("blog");
  const { data } = await anonClient().from("blog_posts").select("slug,title,excerpt,cover_url,publish_at").order("publish_at", { ascending: false }).limit(limit);
  return data ?? [];
}

export async function getPost(slug: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 }); cacheTag("blog");
  const { data } = await anonClient().from("blog_posts").select("slug,title,excerpt,body_md,cover_url,publish_at").eq("slug", slug).maybeSingle();
  return data;
}

export async function getAnnouncements() {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 3600 }); cacheTag("announcements");
  const { data } = await anonClient().from("announcements").select("id,message,level").order("starts_at", { ascending: false }).limit(3);
  return data ?? [];
}

export async function getPlans() {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 });
  const { data } = await anonClient().from("plans").select("id,name,price_idr,duration_days").eq("active", true).order("sort_order");
  return data ?? [];
}

function norm(m: Mover): Mover {
  return { ...m, close: Number(m.close), change_pct: m.change_pct === null ? null : Number(m.change_pct), value: Number(m.value), volume: Number(m.volume),
    net_foreign: m.net_foreign === null || m.net_foreign === undefined ? null : Number(m.net_foreign), spark: m.spark ? m.spark.map(Number) : null };
}
