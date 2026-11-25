import { createClient } from "npm:@supabase/supabase-js@2";
import { FEATURES, walkForwardRidge } from "../_shared/ridge.ts";

// Dua model berdampingan agar bisa dibandingkan secara walk-forward.
// v1: fitur lama. v2: skor suara jujur (jendela 30 label, bobot 120/250/500 hari sebelum hari prediksi) tanpa broker, target di-winsor.
const MODELS: Record<string, { view: string; features: string[]; winsor: number | null }> = {
  ridge_v1: { view: "v_model_input", features: [...FEATURES], winsor: null },
  ridge_v2: {
    view: "v_model_input_v2", winsor: 0.03,
    features: ["v_total", "v_indeks_global", "v_komoditas", "v_kurs", "v_proksi_id", "v_proksi_saham",
      "breadth_ratio", "pct_above_ma20", "net_foreign_ratio", "value_up_log", "seas_dow", "seas_wom", "seas_month", "seas_yearend", "mom1", "mom5", "mom20"],
  },
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const secret = req.headers.get("x-pipeline-secret") ?? "";
  const { data: ok } = await sb.rpc("pipeline_secret_ok", { p: secret });
  if (!ok) return json({ error: "unauthorized" }, 401);

  const t0 = Date.now();
  const body = await req.json().catch(() => ({}));
  const from: string = body.from ?? new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  const MODEL_ID: string = body.model_id ?? "ridge_v1";
  const cfg = MODELS[MODEL_ID];
  if (!cfg) return json({ error: "model_id tidak dikenal" }, 400);
  const FEATS = cfg.features;

  // ambil seluruh masukan model (berhalaman)
  const rows: Record<string, number | string | null>[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb.from(cfg.view).select("*").order("trade_date").range(off, off + 999);
    if (error) return json({ error: error.message }, 500);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  if (rows.length < 70) return json({ status: "empty", rows: rows.length });

  const X = rows.map((r) => FEATS.map((f) => { const v = r[f]; return typeof v === "number" && isFinite(v) ? v : 0; }));
  const w = cfg.winsor;
  const y = rows.map((r) => (typeof r.target === "number" ? (w ? Math.max(-w, Math.min(w, r.target as number)) : (r.target as number)) : null));
  const steps = walkForwardRidge(X, y);

  const forecasts: unknown[] = []; const fits: unknown[] = [];
  steps.forEach((s, i) => {
    const date = rows[i].trade_date as string;
    if (!s.ready || date < from) return;
    const order = s.contrib.map((c, k) => ({ f: FEATS[k], c })).sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 3);
    forecasts.push({
      model_id: MODEL_ID, made_on: date, target_date: rows[i].target_date, pred_return: s.pred,
      direction: s.direction, confidence: Math.min(Math.max(s.confidence, 0), 1), neutral_band: s.sigma,
      reasons: order.map((o) => ({ feature: o.f, contribution: Number(o.c.toFixed(6)) })),
    });
    fits.push({
      model_id: MODEL_ID, fit_date: date, lambda: s.lambda, intercept: s.intercept, n_train: s.n,
      coefs: Object.fromEntries(FEATS.map((f, k) => [f, s.coefs[k]])),
      means: Object.fromEntries(FEATS.map((f, k) => [f, s.means[k]])),
      stds: Object.fromEntries(FEATS.map((f, k) => [f, s.stds[k]])),
    });
  });

  for (let i = 0; i < forecasts.length; i += 500) {
    const a = await sb.from("forecasts").upsert(forecasts.slice(i, i + 500), { onConflict: "model_id,made_on", ignoreDuplicates: true });
    if (a.error) return json({ error: a.error.message }, 500);
    const b = await sb.from("model_fits").upsert(fits.slice(i, i + 500), { onConflict: "model_id,fit_date", ignoreDuplicates: true });
    if (b.error) return json({ error: b.error.message }, 500);
  }
  const ev = await sb.rpc("evaluate_forecasts", { p_model: MODEL_ID });
  await sb.from("ingest_log").insert({ source: "model", status: "ok", rows_in: rows.length, rows_ok: forecasts.length, duration_ms: Date.now() - t0, message: MODEL_ID + " walk-forward" });
  return json({ status: "ok", rows: rows.length, forecasts: forecasts.length, evaluated: ev.data ?? null, ms: Date.now() - t0 });
});
