"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AreaSeries, CandlestickSeries, ColorType, HistogramSeries, LineSeries, LineStyle, createChart, type IChartApi, type IPriceLine, type ISeriesApi, type Time } from "lightweight-charts";
import { ChartCandlestick, ChartLine } from "lucide-react";
import Chart, { type Point } from "@/components/Chart";
import { Locked } from "@/components/ui";
import { useSignedIn } from "@/components/useSignedIn";
import { compact } from "@/lib/format";
import { mprice } from "@/lib/market";
import { INTERVALS, RANGES, defaultInterval, isIntraday, rangeChange, sma, validCombo, type Bar, type ChartPayload, type Interval, type Range } from "@/lib/yahoo";

// Label rentang mengikuti kebiasaan aplikasi sekuritas (1H, 1M, 3B, YTD, 1T, Maks) supaya langsung familiar.
const RANGE_LABEL: Record<Range, string> = { "1d": "1H", "5d": "5H", "1mo": "1B", "3mo": "3B", "6mo": "6B", ytd: "YTD", "1y": "1T", "2y": "2T", "5y": "5T", "10y": "10T", max: "Maks" };
const RANGE_LONG: Record<Range, string> = { "1d": "1 hari", "5d": "5 hari", "1mo": "1 bulan", "3mo": "3 bulan", "6mo": "6 bulan", ytd: "tahun berjalan", "1y": "1 tahun", "2y": "2 tahun", "5y": "5 tahun", "10y": "10 tahun", max: "seluruh riwayat" };
const INTERVAL_LABEL: Record<Interval, string> = { "1m": "1 menit", "5m": "5 menit", "15m": "15 menit", "30m": "30 menit", "1h": "1 jam", "1d": "Harian", "1wk": "Mingguan", "1mo": "Bulanan" };
const GUEST_RANGES: Range[] = ["1d", "5d", "1mo"];
type Resp = ChartPayload & { range: Range; interval: Interval };

const fmtTime = (b: Bar, intraday: boolean) => {
  const d = typeof b.time === "number" ? new Date(b.time * 1000) : new Date(`${b.time}T00:00:00Z`);
  return d.toLocaleString("id-ID", intraday ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" } : { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
const cls = (n: number | null) => (n === null || n === 0 ? "flat" : n > 0 ? "up" : "down");

/**
 * Grafik data langsung dari Yahoo Finance (lewat /api/chart), disusun seperti aplikasi sekuritas: harga besar berwarna hijau/merah,
 * rentang 1H–Maks, garis atau candlestick, volume, MA, legenda OHLC saat kursor digeser. Bila Yahoo gagal, memakai data harian dari database.
 */
export default function MarketChart({ symbol, label, height = 360, defaultRange = "1y", fallback, gateLong = false }: { symbol: string; label: string; height?: number; defaultRange?: Range; fallback?: Point[]; gateLong?: boolean }) {
  const signedIn = useSignedIn();
  const [range, setRange] = useState<Range>(defaultRange);
  const [interval, setIntervalV] = useState<Interval>(defaultInterval(defaultRange));
  const [kind, setKind] = useState<"area" | "candle">("area");
  const [volume, setVolume] = useState(true);
  const [ma, setMa] = useState(false);
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [themeKey, setThemeKey] = useState(0);
  const [hover, setHover] = useState<Bar | null>(null);
  const [narrow, setNarrow] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<"Area"> | ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maRef = useRef<{ s: ISeriesApi<"Line">; p: number }[]>([]);
  const lineRef = useRef<IPriceLine | null>(null);
  const barsRef = useRef<Bar[]>([]);
  const fitNext = useRef(true);
  const token = useRef(0);

  useEffect(() => {
    const bump = () => setThemeKey((k) => k + 1);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-cb"] });
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrow(mq.matches); sync(); mq.addEventListener("change", sync);
    return () => { mo.disconnect(); mq.removeEventListener("change", sync); };
  }, []);

  // Token menolak jawaban yang datang terlambat (ganti rentang/interval/simbol saat permintaan lama masih berjalan).
  const load = useCallback(async (r: Range, i: Interval, quiet: boolean, mine: number) => {
    try {
      const res = await fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${r}&interval=${i}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "gagal");
      if (token.current === mine) { setData(j as Resp); setErr(null); }
    } catch (e) { if (token.current === mine) setErr((e as Error).message); }
    finally { if (token.current === mine && !quiet) setLoading(false); }
  }, [symbol]);

  useEffect(() => {
    const mine = ++token.current;
    fitNext.current = true;
    setData(null); setErr(null); setLoading(true); setHover(null);
    load(range, interval, false, mine);
    // Pembaruan otomatis: tiap 20 detik untuk interval menit/jam, tiap 60 detik untuk harian ke atas; berhenti saat tab tersembunyi.
    const ms = isIntraday(interval) ? 20_000 : 60_000;
    const id = window.setInterval(() => { if (!document.hidden) load(range, interval, true, mine); }, ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { token.current++; window.clearInterval(id); };
  }, [range, interval, load]);

  const bars: Bar[] = useMemo(() => data?.bars ?? [], [data]);
  useEffect(() => { barsRef.current = bars; }, [bars]);
  const ch = useMemo(() => rangeChange(bars, range, data?.price ?? null, data?.previousClose ?? null), [bars, range, data?.price, data?.previousClose]);
  const trend = ch === null ? 0 : ch.abs;
  const intraday = !!data?.intraday, prevClose = data?.previousClose ?? null;

  const colors = useCallback(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (n: string, d: string) => css.getPropertyValue(n).trim() || d;
    return { up: v("--up", "#0e9f6e"), down: v("--down", "#e02d3c"), muted: v("--muted", "#64748b"), line: v("--line", "#e5e7eb"), brand: v("--brand", "#2554d6") };
  }, []);

  const paint = useCallback(() => {
    const chart = chartRef.current, main = mainRef.current;
    if (!chart || !main) return;
    const c = colors();
    const t = (b: Bar) => b.time as Time;
    if (kind === "candle") (main as ISeriesApi<"Candlestick">).setData(bars.map((b) => ({ time: t(b), open: b.open, high: b.high, low: b.low, close: b.close })));
    else {
      // Warna garis mengikuti arah perubahan: hijau bila naik, merah bila turun, seperti Stockbit.
      const col = trend >= 0 ? c.up : c.down;
      (main as ISeriesApi<"Area">).applyOptions({ lineColor: col, topColor: col + "40", bottomColor: col + "05" });
      (main as ISeriesApi<"Area">).setData(bars.map((b) => ({ time: t(b), value: b.close })));
    }
    volRef.current?.setData(bars.map((b, i) => ({ time: t(b), value: b.volume, color: (b.close >= (i > 0 ? bars[i - 1].close : b.open) ? c.up : c.down) + "99" })));
    maRef.current.forEach(({ s, p }) => s.setData(sma(bars, p).map((x) => ({ time: x.time as Time, value: x.value }))));
    if (lineRef.current) { main.removePriceLine(lineRef.current); lineRef.current = null; }
    if (range === "1d" && prevClose && bars.length) lineRef.current = main.createPriceLine({ price: prevClose, color: c.muted, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "Tutup kemarin" });
    chart.applyOptions({ timeScale: { timeVisible: intraday } });
    if (fitNext.current && bars.length) { chart.timeScale().fitContent(); fitNext.current = false; }
  }, [bars, kind, trend, range, intraday, prevClose, colors]);
  useEffect(() => { paint(); }, [paint]);

  const h = narrow ? Math.min(height, 300) : height;
  // Buat grafik (ulang bila jenis, volume, MA, tema, atau tinggi berubah).
  useEffect(() => {
    if (!box.current) return;
    const c = colors();
    const chart = createChart(box.current, {
      height: h, width: box.current.clientWidth,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: c.muted, fontFamily: "inherit", fontSize: 12 },
      grid: { vertLines: { visible: false }, horzLines: { color: c.line } },
      rightPriceScale: { borderVisible: false, minimumWidth: 56 }, crosshair: { mode: 1 },
      localization: { locale: "id-ID", priceFormatter: (p: number) => (p < 0 ? "" : mprice(p)) },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 2 },
      handleScale: { mouseWheel: false }, handleScroll: { mouseWheel: false, vertTouchDrag: false },
    });
    const main = kind === "candle"
      ? chart.addSeries(CandlestickSeries, { upColor: c.up, downColor: c.down, borderUpColor: c.up, borderDownColor: c.down, wickUpColor: c.up, wickDownColor: c.down, priceLineVisible: true })
      : chart.addSeries(AreaSeries, { lineColor: c.up, lineWidth: 2, topColor: c.up + "40", bottomColor: c.up + "05", priceLineVisible: true, crosshairMarkerRadius: 4 });
    let vol: ISeriesApi<"Histogram"> | null = null;
    if (volume) {
      vol = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    }
    main.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: volume ? 0.22 : 0.05 } });
    const lines: { s: ISeriesApi<"Line">; p: number }[] = [];
    if (ma) for (const [p, col] of [[20, "#f59e0b"], [50, "#8b5cf6"]] as const) lines.push({ p, s: chart.addSeries(LineSeries, { color: col, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }) });
    chart.subscribeCrosshairMove((param) => {
      const i = param.logical === undefined || param.time === undefined ? -1 : Math.round(param.logical as number);
      setHover(i >= 0 && i < barsRef.current.length ? barsRef.current[i] : null);
    });
    chartRef.current = chart; mainRef.current = main; volRef.current = vol; maRef.current = lines; lineRef.current = null; fitNext.current = true;
    const ro = new ResizeObserver(() => box.current && chart.applyOptions({ width: box.current.clientWidth }));
    ro.observe(box.current);
    paint();
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; mainRef.current = null; volRef.current = null; maRef.current = []; lineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, volume, ma, h, themeKey]);

  const locked = (r: Range) => gateLong && signedIn === false && !GUEST_RANGES.includes(r);
  const pickRange = (r: Range) => { if (r === range) return; setRange(r); setIntervalV(defaultInterval(r)); }; // ganti rentang selalu memilih interval yang sesuai
  const lastBar = bars[bars.length - 1];
  const price = data?.price ?? lastBar?.close ?? null;
  const marketTime = data?.marketTime ? new Date(data.marketTime * 1000).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB" : null;
  const stats = useMemo(() => bars.length ? { hi: Math.max(...bars.map((b) => b.high)), lo: Math.min(...bars.map((b) => b.low)), vol: bars.reduce((a, b) => a + b.volume, 0), open: bars[0].open } : null, [bars]);
  const legend = hover ?? lastBar ?? null;
  const legendIdx = legend ? bars.indexOf(legend) : -1;
  const legendPrev = legendIdx > 0 ? bars[legendIdx - 1].close : null;
  const legendChg = legend && legendPrev ? (legend.close / legendPrev - 1) * 100 : null;
  const tab = (on: boolean) => `inline-flex h-10 min-w-11 shrink-0 items-center justify-center rounded-md px-2.5 text-meta font-medium transition-colors disabled:opacity-40 ${on ? "bg-surface text-foreground shadow-[inset_0_0_0_1px_var(--line)]" : "text-muted hover:text-foreground"}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className={`text-display font-semibold ${cls(ch?.abs ?? null)}`}>{price !== null ? mprice(price) : "–"}{data?.currency && <span className="ms-1.5 text-sm font-normal text-muted">{data.currency}</span>}</p>
          <p className="text-sm">
            {ch ? <span className={`font-semibold ${cls(ch.abs)}`}>{ch.abs > 0 ? "▲" : ch.abs < 0 ? "▼" : "■"} {sign(ch.abs)}{mprice(Math.abs(ch.abs))} ({sign(ch.pct)}{Math.abs(ch.pct).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)</span> : <span className="text-muted">–</span>}
            <span className="ms-2 text-meta text-muted">{range === "1d" ? "hari ini" : RANGE_LONG[range]}{marketTime ? ` · ${marketTime}` : ""}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Jenis grafik">
            <button type="button" className={`${tab(kind === "area")} !min-w-[40px]`} aria-pressed={kind === "area"} aria-label="Grafik garis" title="Garis" onClick={() => setKind("area")}><ChartLine size={16} aria-hidden="true" /></button>
            <button type="button" className={`${tab(kind === "candle")} !min-w-[40px]`} aria-pressed={kind === "candle"} aria-label="Grafik candlestick" title="Candlestick" onClick={() => setKind("candle")}><ChartCandlestick size={16} aria-hidden="true" /></button>
          </div>
          <button type="button" className="chip" aria-pressed={volume} onClick={() => setVolume(!volume)}>Volume</button>
          <button type="button" className="chip" aria-pressed={ma} onClick={() => setMa(!ma)} title="Rata-rata bergerak 20 dan 50 batang">MA</button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 border-b border-line pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="-mx-1 flex min-w-0 gap-0.5 overflow-x-auto px-1 [scrollbar-width:none]" role="group" aria-label="Rentang waktu">
          {RANGES.map((r) => <button key={r} type="button" className={tab(range === r)} aria-pressed={range === r} aria-label={RANGE_LONG[r]} disabled={locked(r)} title={locked(r) ? "Masuk untuk rentang lebih panjang" : RANGE_LONG[r]} onClick={() => pickRange(r)}>{RANGE_LABEL[r]}</button>)}
        </div>
        <select className="input !h-8 !min-h-0 w-auto shrink-0 self-start py-0 text-meta sm:self-auto" aria-label="Interval" value={interval} onChange={(e) => { fitNext.current = true; setIntervalV(e.target.value as Interval); }}>
          {INTERVALS.map((i) => <option key={i} value={i} disabled={!validCombo(range, i)}>{INTERVAL_LABEL[i]}</option>)}
        </select>
      </div>

      <p className="mt-2 min-h-[20px] text-caption tabular-nums text-muted" aria-live="off">
        {legend && <>
          <span className="me-2">{fmtTime(legend, !!data?.intraday)}</span>
          <span className="me-2">B <b className="font-medium text-foreground">{mprice(legend.open)}</b></span>
          <span className="me-2">T <b className="font-medium text-foreground">{mprice(legend.high)}</b></span>
          <span className="me-2">R <b className="font-medium text-foreground">{mprice(legend.low)}</b></span>
          <span className="me-2">P <b className={`font-medium ${cls(legend.close - legend.open)}`}>{mprice(legend.close)}</b></span>
          {legendChg !== null && <span className={`me-2 font-medium ${cls(legendChg)}`}>{sign(legendChg)}{Math.abs(legendChg).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>}
          {legend.volume > 0 && <span>Vol <b className="font-medium text-foreground">{compact(legend.volume)}</b></span>}
        </>}
      </p>

      <div className="relative mt-1" aria-busy={loading}>
        <div ref={box} role="img" aria-label={`${label}, ${RANGE_LONG[range]}, ${INTERVAL_LABEL[interval]}`} style={{ height: h }} className="w-full" />
        {loading && <div className="skeleton absolute inset-0 grid place-items-center rounded-md opacity-70" role="status"><span className="rounded-full bg-background/80 px-3 py-1 text-meta text-muted">Memuat grafik…</span></div>}
        {err && !data && !loading && (fallback?.length ? <div className="absolute inset-0 bg-background"><Chart data={fallback} height={h} label={label} /></div> : <p role="alert" className="absolute inset-0 grid place-items-center bg-background text-center text-muted">Data grafik belum dapat dimuat ({err}).</p>)}
        {!err && !loading && data && bars.length === 0 && <p className="absolute inset-0 grid place-items-center bg-background text-center text-muted">Belum ada data pada rentang ini. Coba rentang atau interval lain.</p>}
      </div>
      {err && data && <p role="status" className="mt-2 text-meta text-muted">Pembaruan terakhir gagal ({err}); menampilkan data sebelumnya.</p>}
      {ma && <p className="mt-1 text-caption text-muted"><span style={{ color: "#f59e0b" }}>━</span> MA20 <span className="ms-2" style={{ color: "#8b5cf6" }}>━</span> MA50</p>}

      {stats && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 text-meta sm:grid-cols-4">
          <div className="flex justify-between sm:block"><dt className="text-muted">Buka</dt><dd className="font-medium tabular-nums">{mprice(stats.open)}</dd></div>
          <div className="flex justify-between sm:block"><dt className="text-muted">Tertinggi</dt><dd className="font-medium tabular-nums up">{mprice(stats.hi)}</dd></div>
          <div className="flex justify-between sm:block"><dt className="text-muted">Terendah</dt><dd className="font-medium tabular-nums down">{mprice(stats.lo)}</dd></div>
          <div className="flex justify-between sm:block"><dt className="text-muted">Volume</dt><dd className="font-medium tabular-nums">{stats.vol > 0 ? compact(stats.vol) : "–"}</dd></div>
        </dl>
      )}
      <p className="mt-2 text-caption text-muted">Sumber: Yahoo Finance; data bursa Indonesia dapat tertunda ±10 menit. Geser grafik untuk menjelajah, arahkan kursor untuk detail.</p>
      {gateLong && signedIn === false && <div className="mt-3"><Locked text="Rentang lebih panjang dari 1 bulan tersedia untuk akun gratis." href="/daftar" cta="Daftar gratis" /></div>}
    </div>
  );
}
