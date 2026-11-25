"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import MarketChart from "@/components/MarketChart";
import PrefsWizard from "@/components/app/PrefsWizard";
import TradeJournal, { TradeForm } from "@/components/app/TradeJournal";
import { RotateCcw } from "lucide-react";
import { Delta, Empty, Skeleton } from "@/components/ui";
import { cached, invalidate, rpcData } from "@/lib/client-cache";
import { allocation, CRITERIA, HOLDS, LOOKBACKS, rp, WHY, type Holding, type Home, type Pick } from "@/lib/beranda";
import { dateId, idr, int, price } from "@/lib/format";
import { reasonText } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";

type Ready = Extract<Home, { needs_setup?: false }>;
const ACTION_STYLE: Record<string, string> = { Beli: "up", "Beli kecil": "up", Tunda: "text-muted", Tambah: "up", Tahan: "text-muted", Kurangi: "down", "Ambil untung": "down", Evaluasi: "down" };
const FDIR = (d: string | null) => (d === "naik" ? "▲ naik" : d === "turun" ? "▼ turun" : "–");

function Recommendation({ h }: { h: Ready }) {
  const o = h.outlook;
  const up = (o?.direction ?? "naik") === "naik";
  const buys = h.picks.filter((p) => p.action !== "Tunda");
  const warn = h.holdings.filter((x) => x.advice === "Kurangi" || x.advice === "Evaluasi" || x.advice === "Ambil untung");
  const add = h.holdings.filter((x) => x.advice === "Tambah");
  const hold = HOLDS.find(([d]) => d === h.prefs.hold_days)?.[1] ?? `${h.prefs.hold_days} hari`;
  const weak = o && o.confidence < 0.55;
  const lines: string[] = [];
  if (up) {
    lines.push(buys.length > 0
      ? `Pasar condong naik. Pertimbangkan membeli bertahap ${buys.length} saham pilihan di bawah, dengan horizon sekitar ${hold}.`
      : "Pasar condong naik, tetapi semua saham pilihan Anda berarah turun menurut model sehingga ditunda. Tunggu atau ubah kriteria.");
    if (add.length) lines.push(`Posisi yang boleh ditambah: ${add.map((x) => x.code).join(", ")}.`);
  } else {
    lines.push("Pasar condong turun. Sebaiknya tunda pembelian baru dan siapkan daftar di bawah untuk saat arah berbalik.");
    if (buys.length) lines.push(`Untuk profil agresif, ${buys.map((p) => p.code).join(", ")} masih boleh dibeli kecil-kecilan.`);
  }
  if (warn.length) lines.push(`Tinjau posisi: ${warn.map((x) => `${x.code} (${x.advice.toLowerCase()})`).join(", ")}.`);
  if (weak) lines.push("Keyakinan rendah: anggap sebagai pertimbangan, bukan perintah.");
  return (
    // Kartu terpenting di halaman: diberi aksen merek (Efek Von Restorff).
    <section className="card card-accent space-y-3" aria-labelledby="h-saran">
      <h2 id="h-saran" className="text-lg">Saran hari ini</h2>
      <p className="text-xl font-semibold leading-7"><span className={up ? "up" : "down"}>{up ? "▲ Condong naik" : "▼ Condong turun"}</span>
        {o && <span className="ms-2 text-sm font-normal text-muted">IHSG {dateId(o.target_date, { day: "numeric", month: "short" })} · keyakinan {Math.round(o.confidence * 100)}%</span>}</p>
      <ul className="list-disc space-y-1 ps-5 text-body">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
    </section>
  );
}

function PickCard({ p, pct, onSaved }: { p: Pick; pct?: number; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="card !p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/saham/${p.code}`} className="text-lg font-semibold text-brand">{p.code}</Link>
          <p className="truncate text-meta text-muted">{p.name}</p>
        </div>
        <div className="text-end">
          <span className={`font-semibold ${ACTION_STYLE[p.action]}`}>{p.action}{pct ? ` · ±${pct}%` : ""}</span>
          <span className="block text-caption text-muted">arah saham {FDIR(p.forecast)}{p.forecast_conf ? ` (${Math.round(p.forecast_conf * 100)}%)` : ""}</span>
        </div>
      </div>
      <p className="mt-2 tabular-nums">{p.close !== null ? price(p.close) : "–"} <Delta value={p.change_pct} /></p>
      {p.why.length > 0 && <p className="mt-1 text-meta">{p.why.map((k) => WHY[k] ?? k).join(" · ")}</p>}
      <details className="mt-2 text-meta">
        <summary className="inline-flex min-h-10 cursor-pointer items-center text-brand">Rincian angka</summary>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-muted">
          <dt>Perubahan periode</dt><dd className="text-end text-foreground">{p.ret >= 0 ? "+" : "−"}{Math.abs(p.ret).toLocaleString("id-ID")}%</dd>
          <dt>Nilai transaksi</dt><dd className="text-end text-foreground">{rp(p.value)}</dd>
          <dt>Volume</dt><dd className="text-end text-foreground">{int(p.volume)} lbr</dd>
          <dt>Frekuensi/hari</dt><dd className="text-end text-foreground">{int(p.freq)}</dd>
          <dt>Net asing</dt><dd className="text-end text-foreground">{rp(p.net_foreign)}</dd>
          <dt>Free float</dt><dd className="text-end text-foreground">{p.free_float !== null ? `${Number(p.free_float).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : "belum tercatat"}</dd>
          <dt>Risiko gorengan</dt><dd className="text-end text-foreground">{p.pump ?? "–"}</dd>
        </dl>
      </details>
      {open
        ? <div className="mt-3"><TradeForm code={p.code} side="buy" defaultPrice={p.close} source="rekomendasi" onDone={() => { setOpen(false); onSaved(); }} onCancel={() => setOpen(false)} /></div>
        : <button type="button" className="btn mt-3 w-full" onClick={() => setOpen(true)}>Catat pembelian</button>}
    </article>
  );
}

function HoldingRow({ x, onSaved }: { x: Holding; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/saham/${x.code}`} className="font-semibold text-brand">{x.code}</Link>
          <span className="ms-2 text-meta text-muted">{x.lots.toLocaleString("id-ID")} lot · rata-rata {price(x.avg_cost)}</span>
          <p className="text-sm tabular-nums">{x.close !== null ? price(x.close) : "–"} {x.pnl_pct !== null && <span className={x.pnl_pct >= 0 ? "up" : "down"}>({x.pnl_pct >= 0 ? "+" : "−"}{Math.abs(x.pnl_pct).toLocaleString("id-ID")}%)</span>}{x.weight !== null && <span className="text-muted"> · {x.weight.toLocaleString("id-ID")}% portofolio</span>}</p>
        </div>
        <div className="text-end"><span className={`font-semibold ${ACTION_STYLE[x.advice]}`}>{x.advice}</span><span className="block max-w-[260px] text-caption text-muted">{x.reason}</span></div>
      </div>
      {open
        ? <div className="mt-2"><TradeForm code={x.code} side="sell" defaultPrice={x.close} onDone={() => { setOpen(false); onSaved(); }} onCancel={() => setOpen(false)} /></div>
        : <button type="button" className="btn btn-sm mt-2" onClick={() => setOpen(true)}>Catat jual</button>}
    </li>
  );
}

export default function PremiumHome() {
  const [h, setH] = useState<Home | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [ver, setVer] = useState(0);

  const load = useCallback(async (fresh = false) => {
    if (fresh) invalidate("home");
    try {
      const d = await cached("home", () => rpcData<Home>(createClient().rpc("premium_home")), 60_000);
      setH(d ?? { needs_setup: true }); setErr(null);
    } catch { setErr("Beranda belum bisa dimuat. Periksa koneksi Anda lalu coba lagi."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Mode dinamis: perbarui otomatis tiap menit selama tab terlihat.
  const dynamic = h && !h.needs_setup && h.prefs.data_mode === "dinamis";
  useEffect(() => {
    if (!dynamic) return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") load(true); }, 60_000);
    return () => window.clearInterval(id);
  }, [dynamic, load]);

  const refresh = useCallback(() => { setVer((v) => v + 1); load(true); }, [load]);

  if (err && !h) return (
    <div role="alert" className="card flex flex-wrap items-center justify-between gap-3">
      <p className="down">{err}</p>
      <button type="button" className="btn" onClick={() => load(true)}><RotateCcw size={16} aria-hidden="true" />Coba lagi</button>
    </div>
  );
  // Kerangka sesuai bentuk akhir halaman (saran, grafik, kartu saham) agar tidak ada loncatan tata letak.
  if (!h) return (
    <div className="space-y-6" role="status" aria-label="Memuat beranda">
      <Skeleton className="h-40" /><Skeleton className="h-80" />
      <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
    </div>
  );
  if (h.needs_setup) return <PrefsWizard initial={null} edit={false} onDone={() => load(true)} />;
  if (editing) return <PrefsWizard initial={h.prefs} edit onDone={() => { setEditing(false); load(true); }} onCancel={() => setEditing(false)} />;

  const alloc = allocation(h.picks, h.risk);
  const total = h.holdings.reduce((s, x) => s + x.lots * 100 * (x.close ?? x.avg_cost), 0);
  const cost = h.holdings.reduce((s, x) => s + x.lots * 100 * x.avg_cost, 0);
  const pl = total - cost;
  const lb = LOOKBACKS.find(([d]) => d === h.prefs.lookback_days)?.[1] ?? "";
  const crit = h.prefs.criteria.map((c) => CRITERIA.find((x) => x.id === c)?.label).filter(Boolean).join(", ");
  const universe = h.prefs.universe_kind === "indeks" ? h.prefs.indexes.join(", ") : h.prefs.universe_kind === "wishlist" ? "Wishlist saya" : "Semua saham likuid";

  return (
    <div className="space-y-6">
      <Recommendation h={h} />

      <section className="card" aria-labelledby="h-ihsg">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="h-ihsg" className="text-lg">Analisis IHSG</h2>
          <span className="text-meta text-muted">{h.prefs.data_mode === "dinamis" ? "Mode dinamis · diperbarui otomatis" : "Mode stabil · dikunci per hari bursa"}</span>
        </div>
        {h.outlook?.reasons && h.outlook.reasons.length > 0 && (
          <ul className="mt-2 list-disc ps-5 text-sm">{h.outlook.reasons.slice(0, 3).map((r) => <li key={r.feature}>{reasonText(r.feature, r.contribution)}</li>)}</ul>
        )}
        <div className="mt-3"><MarketChart symbol="^JKSE" label="IHSG" height={240} defaultRange="1mo" /></div>
        <p className="mt-2 text-meta"><Link href="/analisis/pasar" className="text-brand underline">Riwayat analisis pasar</Link></p>
      </section>

      <section aria-labelledby="h-pilihan">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="h-pilihan" className="text-lg">Saham pilihan untuk Anda</h2>
          <span className="text-meta text-muted">data {dateId(h.date, { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
        <p className="mt-1 text-meta text-muted">{universe} · {crit} · amatan {lb} · {h.prefs.buy_style === "dip" ? "cenderung beli saat turun" : h.prefs.buy_style === "momentum" ? "cenderung beli saat naik" : "arah harga netral"}</p>
        {h.picks.length === 0
          ? <div className="mt-3"><Empty title="Belum ada saham yang memenuhi syarat"
              message={h.prefs.universe_kind === "wishlist" && h.wishlist_count === 0 ? "Watchlist Anda masih kosong. Tambahkan saham, atau pilih daftar saham lain di preferensi." : "Coba longgarkan kriteria atau pilih daftar saham yang lebih luas."}
              action={h.prefs.universe_kind === "wishlist" && h.wishlist_count === 0 ? <Link href="/watchlist" className="btn btn-primary">Tambah ke watchlist</Link> : <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>Ubah preferensi</button>} /></div>
          : <div className="mt-3 grid gap-3 md:grid-cols-2">{h.picks.map((p) => <PickCard key={p.code} p={p} pct={alloc.get(p.code)} onSaved={refresh} />)}</div>}
      </section>

      <section className="card" aria-labelledby="h-porto">
        <h2 id="h-porto" className="text-lg">Portofolio saya</h2>
        {h.holdings.length === 0
          ? <p className="mt-2 text-sm text-muted">Belum ada posisi. Catat pembelian dari kartu saham di atas atau lewat Jurnal aksi di bawah.</p>
          : (
            <>
              <p className="mt-1 text-sm text-muted">Nilai {idr(Math.round(total))} · untung/rugi belum terealisasi <span className={pl >= 0 ? "up" : "down"}>{pl >= 0 ? "+" : "−"}{idr(Math.round(Math.abs(pl)))}</span>{h.realized !== 0 && <> · terealisasi <span className={h.realized >= 0 ? "up" : "down"}>{h.realized >= 0 ? "+" : "−"}{idr(Math.abs(h.realized))}</span></>}</p>
              <ul className="mt-2 divide-y divide-line">{h.holdings.map((x) => <HoldingRow key={x.code} x={x} onSaved={refresh} />)}</ul>
              <p className="mt-2 text-caption text-muted">Batas rugi {h.stop_pct}% dan target untung {h.tp_pct}% mengikuti profil risiko {h.risk} Anda.</p>
            </>
          )}
      </section>

      <TradeJournal version={ver} onChange={refresh} />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="btn" onClick={() => setEditing(true)}>Ubah preferensi</button>
        <Link href="/akun" className="inline-flex min-h-10 items-center text-muted underline">Profil risiko dan akun</Link>
        <Link href="/analisis" className="inline-flex min-h-10 items-center text-muted underline">Analisis bebas</Link>
      </div>
    </div>
  );
}
