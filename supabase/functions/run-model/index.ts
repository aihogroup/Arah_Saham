import { createClient } from "npm:@supabase/supabase-js@2";
import { FEATURES, walkForwardRidge } from "../_shared/ridge.ts";

const MODEL_ID = "ridge_v1";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const secret = req.headers.get("x-pipeline-secret") ?? "";
  const { data: ok } = await sb.rpc("pipeline_secret_ok", { p: secret });
  if (!ok) return json({ error: "unauthorized" }, 401);

  const t0 = Date.now();
  const body = await req.json().catch(() => ({}));
  const from: string = body.from ?? new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);

  // ambil seluruh masukan model (berhalaman)
  const rows: Record<string, number | string | null>[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb.from("v_model_input").select("*").order("trade_date").range(off, off + 999);
    if (error) return json({ error: error.message }, 500);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  if (rows.length < 70) return json({ status: "empty", rows: rows.length });

  const X = rows.map((r) => FEATURES.map((f) => { const v = r[f]; return typeof v === "number" && isFinite(v) ? v : 0; }));
  const y = rows.map((r) => (typeof r.target === "number" ? (r.target as number) : null));
  const steps = walkForwardRidge(X, y);

  const forecasts: unknown[] = []; const fits: unknown[] = [];
  steps.forEach((s, i) => {
    const date = rows[i].trade_date as string;
    if (!s.ready || date < from) return;
    const order = s.contrib.map((c, k) => ({ f: FEATURES[k], c })).sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 3);
    forecasts.push({
      model_id: MODEL_ID, made_on: date, target_date: rows[i].target_date, pred_return: s.pred,
      direction: s.direction, confidence: Math.min(Math.max(s.confidence, 0), 1), neutral_band: s.sigma,
      reasons: order.map((o) => ({ feature: o.f, contribution: Number(o.c.toFixed(6)) })),
    });
    fits.push({
      model_id: MODEL_ID, fit_date: date, lambda: s.lambda, intercept: s.intercept, n_train: s.n,
      coefs: Object.fromEntries(FEATURES.map((f, k) => [f, s.coefs[k]])),
      means: Object.fromEntries(FEATURES.map((f, k) => [f, s.means[k]])),
      stds: Object.fromEntries(FEATURES.map((f, k) => [f, s.stds[k]])),
    });
  });

  for (let i = 0; i < forecasts.length; i += 500) {
    const a = await sb.from("forecasts").upsert(forecasts.slice(i, i + 500), { onConflict: "model_id,made_on", ignoreDuplicates: true });
    if (a.error) return json({ error: a.error.message }, 500);
    const b = await sb.from("model_fits").upsert(fits.slice(i, i + 500), { onConflict: "model_id,fit_date", ignoreDuplicates: true });
    if (b.error) return json({ error: b.error.message }, 500);
  }
  const ev = await sb.rpc("evaluate_forecasts", { p_model: MODEL_ID });
  await sb.from("ingest_log").insert({ source: "model", status: "ok", rows_in: rows.length, rows_ok: forecasts.length, duration_ms: Date.now() - t0, message: "ridge walk-forward" });
  return json({ status: "ok", rows: rows.length, forecasts: forecasts.length, evaluated: ev.data ?? null, ms: Date.now() - t0 });
});
