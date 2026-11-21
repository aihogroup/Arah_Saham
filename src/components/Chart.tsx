"use client";

import { useEffect, useRef, useState } from "react";
import { AreaSeries, ColorType, createChart, type Time } from "lightweight-charts";

export type Point = { time: string; value: number };

/** Grafik garis/area ringan (TradingView Lightweight Charts). Data datang dari database sendiri. */
export default function Chart({ data, height = 280, label }: { data: Point[]; height?: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [themeKey, setThemeKey] = useState(0);

  // Gambar ulang saat tema berubah (atribut data-theme atau preferensi sistem).
  useEffect(() => {
    const bump = () => setThemeKey((k) => k + 1);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", bump);
    return () => { mo.disconnect(); mq.removeEventListener("change", bump); };
  }, []);

  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    const css = getComputedStyle(document.documentElement);
    const up = data[data.length - 1].value >= data[0].value;
    const color = (up ? css.getPropertyValue("--up") : css.getPropertyValue("--down")).trim() || "#2554d6";
    const chart = createChart(ref.current, {
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: css.getPropertyValue("--muted").trim() || "#64748b", fontFamily: "inherit" },
      grid: { vertLines: { visible: false }, horzLines: { color: css.getPropertyValue("--line").trim() || "#e5e7eb" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: 1 },
    });
    const series = chart.addSeries(AreaSeries, { lineColor: color, lineWidth: 2, topColor: color + "22", bottomColor: color + "00", priceLineVisible: false });
    series.setData(data.map((d) => ({ time: d.time as Time, value: d.value })));
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => ref.current && chart.applyOptions({ width: ref.current.clientWidth }));
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [data, height, themeKey]);

  return <div ref={ref} role="img" aria-label={label} style={{ height }} className="w-full" />;
}
