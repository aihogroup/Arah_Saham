import { createClient } from "npm:@supabase/supabase-js@2";
import { runRidge, type Row } from "./core.ts";

const MODEL_ID = "ridge_mv";
const HARI = 1000; // jumlah hari uji (riwayat)
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

// Kunci alasan yang sudah punya teks di aplikasi (labels.ts): kontribusi dijumlah per kelompok.
const ALASAN: Record<string, string> = {
  komoditas: "g_komoditas", kurs: "g_kurs", indeks_global: "g_indeks_global", proksi_id: "g_proksi_id", proksi_saham: "v_proksi_saham",
  b_value_down: "g_broker_value", b_freq_down: "g_broker_frequency", b_foreign_net: "net_foreign_ratio", b_adv: "breadth_ratio",
};
const nextBizDay = (d: string) => { const t = new Date(d + "T00:00:00Z"); do { t.setUTCDate(t.getUTCDate() + 1); } while (t.getUTCDay() % 6 === 0); return t.toISOString().slice(0, 10); };

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const secret = req.headers.get("x-pipeline-secret") ?? "";
  const { data: ok } = await sb.rpc("pipeline_secret_ok", { p: secret });
  if (!ok) return json({ error: "unauthorized" }, 401);

  const t0 = Date.now();
  const { data: inp, error } = await sb.rpc("ridge_mv_inputs");
  if (error) return json({ error: error.message }, 500);
  const rows = inp.rows as Row[]; const groups = inp.groups as Record<string, string>;

  // awal uji dikunci pada tanggal tetap (bukan bergeser) agar ramalan lama tidak berubah; tahun ke depan riwayat tumbuh melebihi 1000 hari
  const body = await req.json().catch(() => ({}));
  let testStart: string = body.test_start ?? "";
  if (!testStart) {
    const { data: first } = await sb.from("forecasts").select("made_on").eq("model_id", MODEL_ID).order("made_on").limit(1);
    testStart = first?.[0]?.made_on ?? rows[Math.max(rows.length - 1 - HARI, 260)].date;
  }
  const res = runRidge(rows, { testStart, lags: 5, refit: 21, minCover: 0.7 });

  const forecasts = res.forecasts.map((f) => {
    const agg: Record<string, number> = {};
    for (const [k, c] of Object.entries(f.contrib)) {
      const g = k.startsWith("lag") ? "mom1" : (ALASAN[k] ?? ALASAN[groups[k]] ?? null);
      if (g) agg[g] = (agg[g] ?? 0) + c;
    }
    const reasons = Object.entries(agg).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3).map(([feature, c]) => ({ feature, contribution: Number(c.toFixed(6)) }));
    const up = f.pred_pct >= 0;
    return {
      model_id: MODEL_ID, made_on: f.date, target_date: f.next_date ?? f.td ?? nextBizDay(f.date), pred_return: f.pred_pct / 100,
      direction: up ? "naik" : "turun", confidence: Math.min(Math.max(up ? f.prob_up : 1 - f.prob_up, 0.5), 1), neutral_band: f.sigma / 100, reasons,
    };
  });
  const fits = res.fits.map((f) => ({ model_id: MODEL_ID, fit_date: f.fit_date, lambda: f.lambda, intercept: f.intercept / 100, n_train: f.n_rows, coefs: f.coef, means: f.mean, stds: f.sd }));

  for (let i = 0; i < forecasts.length; i += 500) {
    const a = await sb.from("forecasts").upsert(forecasts.slice(i, i + 500), { onConflict: "model_id,made_on", ignoreDuplicates: true });
    if (a.error) return json({ error: a.error.message }, 500);
  }
  for (let i = 0; i < fits.length; i += 200) {
    const b = await sb.from("model_fits").upsert(fits.slice(i, i + 200), { onConflict: "model_id,fit_date", ignoreDuplicates: true });
    if (b.error) return json({ error: b.error.message }, 500);
  }
  const ev = await sb.rpc("finalize_ridge_mv", { p_model: MODEL_ID });
  await sb.from("ingest_log").insert({ source: "model", status: "ok", rows_in: rows.length, rows_ok: forecasts.length, duration_ms: Date.now() - t0, message: `${MODEL_ID} lambda=${res.meta.lambda} fitur=${res.meta.n_features}` });
  return json({ status: "ok", rows: rows.length, test_start: testStart, forecasts: forecasts.length, fits: fits.length, lambda: res.meta.lambda, features: res.meta.n_features, finalized: ev.data ?? null, ms: Date.now() - t0 });
});
