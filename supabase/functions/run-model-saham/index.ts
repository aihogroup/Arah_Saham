import { createClient } from "npm:@supabase/supabase-js@2";
import { walkForwardFast } from "../_shared/ridge_fast.ts";

// Model ridge walk-forward per saham (universe likuid di dwh.universe). Satu panggilan memproses {offset, limit} saham.
const MODEL_ID = "ridge_stock_v1";
const OPTS = { multipliers: [0.1, 1, 10, 100, 1000], minTrain: 120 };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

type Batch = { code: string; cols: string[]; dates: string[]; next: (string | null)[]; y: (number | null)[]; rows: (number | null)[][] };

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: ok } = await sb.rpc("pipeline_secret_ok", { p: req.headers.get("x-pipeline-secret") ?? "" });
  if (!ok) return json({ error: "unauthorized" }, 401);
  const t0 = Date.now();
  const b = await req.json().catch(() => ({}));
  const offset = Math.max(0, Number(b.offset ?? 0)); const limit = Math.min(Math.max(Number(b.limit ?? 2), 1), 12);
  const from: string = b.from ?? new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);

  const { data, error } = await sb.rpc("model_stock_batch", { p_offset: offset, p_limit: limit });
  if (error) return json({ error: error.message }, 500);
  const stocks = (data ?? []) as Batch[];
  let made = 0; const failed: string[] = [];

  for (const s of stocks) {
    if (!s.dates || s.dates.length < 150) continue;
    const X = s.rows.map((r) => r.map((v) => (typeof v === "number" && isFinite(v) ? v : 0)));
    const y = s.y.map((v) => (typeof v === "number" && isFinite(v) ? v : null));
    const steps = walkForwardFast(X, y, OPTS);
    const out: unknown[] = [];
    steps.forEach((st, i) => {
      const date = s.dates[i];
      if (!st.ready || date < from) return;
      const top = st.contrib.map((c, k) => ({ f: s.cols[k], c })).sort((a, c) => Math.abs(c.c) - Math.abs(a.c)).slice(0, 3);
      out.push({
        stock_code: s.code, model_id: MODEL_ID, made_on: date, target_date: s.next[i], pred_return: st.pred, direction: st.direction,
        confidence: Math.min(Math.max(st.confidence, 0), 1), sigma: st.sigma,
        reasons: top.map((o) => ({ feature: o.f, contribution: Number(o.c.toFixed(6)) })),
      });
    });
    for (let i = 0; i < out.length; i += 500) {
      const r = await sb.from("stock_forecasts").upsert(out.slice(i, i + 500), { onConflict: "stock_code,model_id,made_on", ignoreDuplicates: true });
      if (r.error) { failed.push(`${s.code}: ${r.error.message}`); break; }
    }
    made += out.length;
  }
  await sb.from("ingest_log").insert({ source: "model_saham", status: failed.length ? "error" : "ok", rows_in: stocks.length, rows_ok: made, duration_ms: Date.now() - t0, message: `offset=${offset} ${failed.join("; ")}`.trim() });
  return json({ status: failed.length ? "error" : "ok", offset, stocks: stocks.length, forecasts: made, failed, ms: Date.now() - t0 });
});
