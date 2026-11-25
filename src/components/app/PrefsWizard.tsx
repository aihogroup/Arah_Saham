"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "@/components/Toaster";
import { ChoiceCard, ProgressBar, Steps } from "@/components/ui";
import { invalidate } from "@/lib/client-cache";
import { CRITERIA, DEFAULT_PREFS, HOLDS, INDEX_OPTIONS, LOOKBACKS, type Prefs } from "@/lib/beranda";
import { createClient } from "@/lib/supabase/client";
import { normalize } from "@/lib/validation";

type Draft = { code: string; lots: string; price: string };
const STEPS = ["Gaya data", "Daftar saham", "Cara membeli", "Kriteria", "Jangka waktu", "Portofolio"] as const;

const Choice = ({ on, onClick, title, body }: { on: boolean; onClick: () => void; title: string; body: string }) =>
  <ChoiceCard checked={on} onSelect={onClick} title={title} body={body} />;

/** Wizard preferensi investasi. `edit` melewati langkah portofolio (portofolio dikelola lewat jurnal). */
export default function PrefsWizard({ initial, edit, onDone, onCancel }: { initial: Prefs | null; edit: boolean; onDone: () => void; onCancel?: () => void }) {
  const [p, setP] = useState<Prefs>(initial ?? DEFAULT_PREFS);
  const [step, setStep] = useState(0);
  const [holds, setHolds] = useState<Draft[]>([{ code: "", lots: "", price: "" }]);
  const [wl, setWl] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const last = edit ? STEPS.length - 2 : STEPS.length - 1;
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setP((x) => ({ ...x, [k]: v }));
  const toggle = (k: "indexes" | "criteria", v: string) => setP((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((i) => i !== v) : [...x[k], v] }));

  useEffect(() => {
    createClient().from("watchlists").select("stock_code", { count: "exact", head: true }).then(({ count }) => setWl(count ?? 0));
  }, []);

  const canNext = step === 1 ? (p.universe_kind !== "indeks" || p.indexes.length > 0) : step === 3 ? p.criteria.length > 0 : true;

  async function save() {
    setBusy(true); setErr(null);
    const sb = createClient();
    const { error } = await sb.rpc("save_invest_prefs", { p_data: p });
    if (error) { setBusy(false); return setErr(error.message.includes("Pilih") ? error.message : "Gagal menyimpan preferensi. Coba lagi."); }
    const failed: string[] = [];
    if (!edit) {
      for (const h of holds) {
        const code = normalize.stockCode(h.code), lots = Math.floor(normalize.number(h.lots)), price = normalize.number(h.price);
        if (!code || !(lots > 0) || !(price > 0)) continue;
        const { error: e } = await sb.rpc("add_trade", { p_code: code, p_side: "buy", p_lots: lots, p_price: price, p_note: "Saldo awal", p_source: "saldo_awal" });
        if (e) failed.push(code);
      }
    }
    setBusy(false);
    invalidate("home"); invalidate("outlook");
    if (failed.length) toast(`Preferensi tersimpan. Kode tidak dikenal dilewati: ${failed.join(", ")}`, "info");
    else toast("Preferensi tersimpan");
    onDone();
  }

  return (
    <section className="card space-y-5" aria-labelledby="h-wiz">
      <div>
        <h2 id="h-wiz" className="text-lg">{edit ? "Ubah preferensi analisis" : "Atur preferensi Anda"}</h2>
        {!edit && <p className="mt-1 text-sm text-muted">Jawaban ini menjadi acuan rekomendasi harian untuk Anda. Hanya sekitar 1 menit dan bisa diubah kapan saja.</p>}
        {/* Kemajuan terlihat jelas agar pengguna terdorong menuntaskan (Efek Zeigarnik). */}
        <div className="mt-3 space-y-2">
          <ProgressBar value={step + 1} max={last + 1} label="Kemajuan pengisian preferensi" />
          <Steps steps={STEPS.slice(0, last + 1)} current={step} />
        </div>
      </div>

      {step === 0 && (
        <fieldset className="space-y-3"><legend className="font-medium">Seberapa sering Anda sempat memantau ArahSaham.com?</legend>
          <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
            <Choice on={p.data_mode === "stabil"} onClick={() => set("data_mode", "stabil")} title="Jarang membuka (stabil)" body="Disarankan bila Anda tidak sempat memantau. Ramalan dikunci sekali per hari bursa sehingga tenang dijadikan acuan. Kekurangannya: kurang tanggap terhadap perubahan data terbaru, jadi bisa kurang akurat dibanding mode dinamis." />
            <Choice on={p.data_mode === "dinamis"} onClick={() => set("data_mode", "dinamis")} title="Sering membuka (dinamis)" body="Disarankan bila Anda bisa membuka ArahSaham.com secara intens. Analisis dihitung ulang dengan data terbaru sehingga lebih tanggap, tetapi arahnya bisa berubah dari ramalan awal dan perlu dipantau." />
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="space-y-3"><legend className="font-medium">Saham mana yang ingin dianalisis?</legend>
          <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
            <Choice on={p.universe_kind === "indeks"} onClick={() => set("universe_kind", "indeks")} title="Saham dalam indeks" body="Pilih satu atau beberapa indeks, mis. IDX30, LQ45, IDX80." />
            <Choice on={p.universe_kind === "wishlist"} onClick={() => set("universe_kind", "wishlist")} title="Wishlist saya" body="Hanya saham di watchlist Anda sendiri." />
            <Choice on={p.universe_kind === "semua"} onClick={() => set("universe_kind", "semua")} title="Semua saham likuid" body="Sekitar 200 saham dengan transaksi paling aktif." />
          </div>
          {p.universe_kind === "indeks" && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Indeks">
              {INDEX_OPTIONS.map(([id, label]) => <button type="button" key={id} className="chip" aria-pressed={p.indexes.includes(id)} onClick={() => toggle("indexes", id)}>{label}</button>)}
            </div>
          )}
          {p.universe_kind === "wishlist" && (
            <p className="text-sm text-muted">{wl === null ? "Memeriksa watchlist…" : wl > 0 ? `Watchlist Anda berisi ${wl} saham.` : "Watchlist Anda masih kosong."} <Link href="/watchlist" className="text-brand underline">Kelola watchlist</Link> (simpan perubahan ini dulu atau lanjutkan, daftar dibaca setiap hari).</p>
          )}
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="space-y-3"><legend className="font-medium">Anda cenderung membeli saat harga…</legend>
          <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
            <Choice on={p.buy_style === "dip"} onClick={() => set("buy_style", "dip")} title="Sedang turun" body="Mencari saham yang terkoreksi wajar. Penurunan terlalu dalam (lebih dari 15%) dihindari." />
            <Choice on={p.buy_style === "momentum"} onClick={() => set("buy_style", "momentum")} title="Sedang naik" body="Mencari saham yang sedang menguat mengikuti tren." />
            <Choice on={p.buy_style === "seimbang"} onClick={() => set("buy_style", "seimbang")} title="Tidak masalah" body="Arah harga baru-baru ini tidak ikut memengaruhi urutan." />
          </div>
        </fieldset>
      )}

      {step === 3 && (
        <fieldset className="space-y-3"><legend className="font-medium">Apa yang biasa Anda lihat saat memilih saham?</legend>
          <p className="text-meta text-muted">Pilih sebanyak yang sesuai. Saham diurutkan dari rata-rata peringkatnya pada kriteria yang Anda pilih.</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Kriteria">
            {CRITERIA.map((c) => <button type="button" key={c.id} className="chip" aria-pressed={p.criteria.includes(c.id)} onClick={() => toggle("criteria", c.id)}>{c.label}</button>)}
          </div>
        </fieldset>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <fieldset className="space-y-3"><legend className="font-medium">Berapa lama data yang Anda amati?</legend>
            <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
              {LOOKBACKS.map(([d, t, b]) => <Choice key={d} on={p.lookback_days === d} onClick={() => set("lookback_days", d)} title={t} body={b} />)}
            </div>
          </fieldset>
          <fieldset className="space-y-3"><legend className="font-medium">Seberapa lama Anda biasanya menahan saham?</legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Lama menahan">
              {HOLDS.map(([d, t]) => <button type="button" key={d} className="chip" aria-pressed={p.hold_days === d} onClick={() => set("hold_days", d)}>{t}</button>)}
            </div>
            <p className="text-meta text-muted">Horizon pendek memberi bobot lebih besar pada arah saham untuk besok; horizon panjang lebih bertumpu pada kriteria di atas.</p>
          </fieldset>
          <fieldset className="space-y-2"><legend className="font-medium">Berapa saham pilihan per hari?</legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Jumlah saham">
              {[3, 5, 8, 10].map((n) => <button type="button" key={n} className="chip" aria-pressed={p.max_picks === n} onClick={() => set("max_picks", n)}>{n} saham</button>)}
            </div>
          </fieldset>
        </div>
      )}

      {step === 5 && !edit && (
        <fieldset className="space-y-3"><legend className="font-medium">Saham yang Anda pegang sekarang (boleh dikosongkan)</legend>
          <p className="text-meta text-muted">Dipakai sebagai komposisi awal portofolio, sehingga saran bisa memperhitungkan porsi dan untung-rugi Anda. Satu lot = 100 lembar.</p>
          <div className="space-y-2">
            {holds.map((h, i) => (
              <div key={i} className="grid grid-cols-[1.1fr_0.8fr_1fr_auto] items-center gap-2">
                <input className="input uppercase" aria-label={`Kode saham ${i + 1}`} placeholder="Kode, mis. BBCA" maxLength={8} value={h.code} onChange={(e) => setHolds((x) => x.map((r, j) => (j === i ? { ...r, code: e.target.value } : r)))} />
                <input className="input" aria-label={`Jumlah lot ${i + 1}`} inputMode="numeric" placeholder="Lot" value={h.lots} onChange={(e) => setHolds((x) => x.map((r, j) => (j === i ? { ...r, lots: e.target.value.replace(/\D/g, "") } : r)))} />
                <input className="input" aria-label={`Harga rata-rata ${i + 1}`} inputMode="decimal" placeholder="Harga rata-rata" value={h.price} onChange={(e) => setHolds((x) => x.map((r, j) => (j === i ? { ...r, price: e.target.value.replace(/[^\d.,]/g, "") } : r)))} />
                <button type="button" className="btn btn-ghost px-3" aria-label={`Hapus baris ${i + 1}`} onClick={() => setHolds((x) => (x.length === 1 ? [{ code: "", lots: "", price: "" }] : x.filter((_, j) => j !== i)))}>×</button>
              </div>
            ))}
          </div>
          {holds.length < 15 && <button type="button" className="btn" onClick={() => setHolds((x) => [...x, { code: "", lots: "", price: "" }])}>+ Tambah saham</button>}
        </fieldset>
      )}

      {err && <p role="alert" className="down">{err}</p>}
      {/* Tombol navigasi wizard menempel di bawah layar ponsel (zona jempol); tombol utama paling kanan/lebar. */}
      <div className="action-bar flex flex-wrap gap-2">
        {step > 0 && <button type="button" className="btn" disabled={busy} onClick={() => setStep(step - 1)}>Kembali</button>}
        {step < last
          ? <button type="button" className="btn btn-primary flex-1 sm:flex-none" disabled={!canNext} aria-busy={false} onClick={() => { setStep(step + 1); document.getElementById("h-wiz")?.scrollIntoView({ block: "start" }); }}>Lanjut</button>
          : <button type="button" className="btn btn-primary flex-1 sm:flex-none" disabled={busy} aria-busy={busy} onClick={save}>{busy ? "Menyimpan…" : edit ? "Simpan preferensi" : "Selesai dan lihat rekomendasi"}</button>}
        {onCancel && <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>Batal</button>}
      </div>
    </section>
  );
}
