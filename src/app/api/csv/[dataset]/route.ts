import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitShared } from "@/lib/rate-limit";

const esc = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = "'" + s; // cegah injeksi rumus spreadsheet
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
};

export async function GET(_req: Request, ctx: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await ctx.params;
  const sb = await createClient();
  const { data: claims } = await sb.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return NextResponse.json({ error: "Perlu login" }, { status: 401 });
  if (!(await rateLimitShared(`csv:${uid}`, 20, 60_000))) return NextResponse.json({ error: "Terlalu cepat" }, { status: 429 });

  let rows: Record<string, unknown>[] = [];
  const peek = async () => {
    if (dataset === "brokers") return (await sb.rpc("broker_share", { p_limit: 500 })).data;
    if (dataset === "ranking") return (await sb.rpc("rankings", { p_kind: "value", p_limit: 100 })).data;
    if (dataset === "saham") return (await sb.rpc("stock_table", { p_index: null, p_q: null, p_limit: 1000, p_after: null })).data;
    if (dataset === "ihsg") return (await sb.rpc("ihsg_series", { p_days: 400 })).data;
    return undefined;
  };
  if (!["brokers", "ranking", "saham", "ihsg"].includes(dataset)) return NextResponse.json({ error: "Dataset tidak ada" }, { status: 404 });

  const { data: allowed } = await sb.rpc("consume_csv_quota");
  if (!allowed) return NextResponse.json({ error: "Kuota unduhan harian habis" }, { status: 429 });

  rows = ((await peek()) as Record<string, unknown>[] | null | undefined) ?? [];
  rows = rows.map(({ spark, ...rest }) => { void spark; return rest; });
  return new NextResponse("﻿" + toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="arah-saham-${dataset}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
