"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Delta, Empty, Skeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { cached, rpcData } from "@/lib/client-cache";
import { INDICATORS, PRESETS, UNIVERSES, METRIC_LABEL, reasonText } from "@/lib/labels";
import { dateId, price } from "@/lib/format";

type Row = { code: string; name: string; sector: string | null; score: number; status: "Pantau" | "Netral" | "Hindari"; close: number | null; change_pct: number | null; indexes: string[]; index_change: string | null; reasons: { metric: string; score: number }[] };
type Result = { date: string | null; market_direction: string | null; universe_size: number; rows: Row[] };
type Outlook = { made_on: string; target_date: string; direction: string; confidence: number; mode?: "stabil" | "dinamis"; snapshot_direction?: string; reasons: { feature: string; contribution: number }[] } | null;
type Preset = { id: string; name: string; universe: string[]; indicators: string[]; risk: string };

const RISKS = [["konservatif", "Konservatif"], ["moderat", "Moderat"], ["agresif", "Agresif"]] as const;
const STATUS_STYLE: Record<string, string> = { Pantau: "up", Hindari: "down", Netral: "text-muted" };
const STATUS_ICON: Record<string, string> = { Pantau: "▲", Hindari: "▼", Netral: "•" };

export default function AnalysisPanel({ defaultRisk }: { defaultRisk: string }) {
  const [universe, setUniverse] = useState<string[]>(["LQ45"]);
  const [inds, setInds] = useState<string[]>(INDICATORS.map((i) => i.id));
  const [risk, setRisk] = useState(defaultRisk);
  const [res, setRes] = useState<Result | null>(null);
  const [outlook, setOutlook] = useState<Outlook>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");

  const loadPresets = useCallback(async () => {
    const { data } = await createClient().from("user_presets").select("id,name,universe,indicators,risk").order("created_at");
    setPresets((data as Preset[]) ?? []);
  }, []);

  const run = useCallback(async (u: string[], i: string[], r: string) => {
    setLoading(true); setErr(null);
    try {
      const key = `analisis:${[...u].sort().join(",")}|${[...i].sort().join(",")}|${r}`;
      const data = await cached(key, () => rpcData<Result>(createClient().rpc("analisis_saya", { p_universe: u, p_indicators: i, p_risk: r })), 3 * 60_000);
      setRes(data ? { ...data, rows: data.rows ?? [] } : null);
    } catch { setErr("Gagal memuat analisis."); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const sb = createClient();
    cached("outlook", () => rpcData<Outlook>(sb.rpc("market_outlook")), 60_000).then((d) => setOutlook(d ?? null)).catch(() => setOutlook(null));
    loadPresets();
    run(["LQ45"], INDICATORS.map((i) => i.id), defaultRisk);
  }, [loadPresets, run, defaultRisk]);

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("user_presets").upsert({ user_id: u.user!.id, name, universe, indicators: inds, risk }, { onConflict: "user_id,name" });
    if (error) return setErr("Gagal menyimpan preset.");
    setPresetName(""); loadPresets();
  }
  async function delPreset(id: string) { await createClient().from("user_presets").delete().eq("id", id); loadPresets(); }

  return (
    <div className="space-y-6">
      {outlook && (
        <div>
        <Link href="/analisis/pasar" className="card block transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-brand" aria-labelledby="h-outlook">
          <h2 id="h-outlook" className="text-lg">Kondisi pasar untuk {dateId(outlook.target_date)}</h2>
          <p className="mt-2 text-xl font-semibold">
            <span className={outlook.direction === "turun" ? "down" : "up"}>
              {outlook.direction === "turun" ? "▼ Condong turun" : "▲ Condong naik"}
            </span>
            <span className="ml-2 text-[14px] font-normal text-muted">keyakinan {Math.round(outlook.confidence * 100)}%</span>
          </p>
          <ul className="mt-3 list-disc pl-5 text-[14px]">{outlook.reasons.slice(0, 4).map((r) => <li key={r.feature}>{reasonText(r.feature, r.contribution)}</li>)}</ul>
          <p className="mt-3 text-[14px] font-medium text-brand">Lihat analisis hari-hari sebelumnya →</p>
        </Link>
          <p className="mt-2 px-1 text-[13px] text-muted">
            {outlook.mode === "dinamis" ? "Mode data dinamis: dihitung ulang dari data terbaru" : "Mode data stabil: ramalan dikunci per hari bursa"}
            {outlook.mode === "dinamis" && outlook.snapshot_direction && outlook.snapshot_direction !== outlook.direction && ` · berubah dari ramalan awal (${outlook.snapshot_direction})`}
            {" · "}<Link href="/akun" className="underline">ubah</Link>
          </p>
        </div>
      )}

      <section className="card space-y-4" aria-labelledby="h-atur">
        <h2 id="h-atur" className="text-lg">Atur analisis</h2>
        <fieldset><legend className="mb-2 text-[14px] font-medium">Kumpulan saham</legend>
          <div className="flex flex-wrap gap-2">{UNIVERSES.map((u) => <button type="button" key={u.id} className="chip" aria-pressed={universe.includes(u.id)} onClick={() => toggle(universe, u.id, setUniverse)}>{u.label}</button>)}</div>
        </fieldset>
        <fieldset><legend className="mb-2 text-[14px] font-medium">Indikator</legend>
          <div className="flex flex-wrap gap-2">
            {INDICATORS.map((i) => <button type="button" key={i.id} className="chip" aria-pressed={inds.includes(i.id)} onClick={() => toggle(inds, i.id, setInds)}>{i.label}</button>)}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[13px]">Cepat: {PRESETS.map((p) => <button type="button" key={p.name} className="underline" onClick={() => setInds([...p.indicators])}>{p.name}</button>)}</div>
        </fieldset>
        <fieldset><legend className="mb-2 text-[14px] font-medium">Profil risiko</legend>
          <div className="flex flex-wrap gap-2">{RISKS.map(([v, l]) => <button type="button" key={v} className="chip" aria-pressed={risk === v} onClick={() => setRisk(v)}>{l}</button>)}</div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" disabled={loading || universe.length === 0 || inds.length === 0} onClick={() => run(universe, inds, risk)}>{loading ? "Menghitung…" : "Jalankan analisis"}</button>
          <label className="sr-only" htmlFor="pn">Nama preset</label>
          <input id="pn" className="input max-w-[200px]" placeholder="Nama preset" value={presetName} onChange={(e) => setPresetName(e.target.value)} maxLength={60} />
          <button className="btn" onClick={savePreset} disabled={!presetName.trim()}>Simpan preset</button>
        </div>
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Preset tersimpan">
            {presets.map((p) => (
              <span key={p.id} className="chip">
                <button type="button" onClick={() => { setUniverse(p.universe); setInds(p.indicators); setRisk(p.risk); run(p.universe, p.indicators, p.risk); }}>{p.name}</button>
                <button type="button" aria-label={`Hapus preset ${p.name}`} className="ml-2 text-muted" onClick={() => delPreset(p.id)}>×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {err && <p role="alert" className="down">{err}</p>}
      {loading && !res && <Skeleton className="h-64" />}
      {res && (
        <section aria-labelledby="h-hasil">
          <h2 id="h-hasil" className="text-lg">Hasil {res.date && <span className="text-[14px] font-normal text-muted">· data {dateId(res.date)} · {res.universe_size} saham dipindai</span>}</h2>
          {res.rows.length === 0 ? <Empty message="Tidak ada saham pada pilihan ini." /> : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {res.rows.map((r) => (
                <article key={r.code} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div><Link href={`/saham/${r.code}`} className="text-lg font-semibold text-brand">{r.code}</Link><p className="text-[13px] text-muted">{r.name}</p></div>
                    <span className={`font-medium ${STATUS_STYLE[r.status]}`}>{STATUS_ICON[r.status]} {r.status}</span>
                  </div>
                  <p className="mt-2 tabular-nums">{r.close !== null ? price(r.close) : "–"} <Delta value={r.change_pct} /></p>
                  <p className="mt-1 text-[13px] text-muted">Skor {r.score >= 0 ? "+" : "−"}{Math.abs(r.score).toFixed(2).replace(".", ",")}{r.indexes.length > 0 && ` · ${r.indexes.join(", ")}`}{r.index_change && ` · baru ${r.index_change === "in" ? "masuk" : "keluar"} indeks`}</p>
                  <ul className="mt-2 list-disc pl-5 text-[13px]">{r.reasons.map((x) => <li key={x.metric}>{x.score >= 0 ? "Mendukung" : "Menekan"}: {METRIC_LABEL[x.metric] ?? x.metric}</li>)}</ul>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
