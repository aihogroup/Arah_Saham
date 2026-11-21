"use client";

import { useMemo, useState } from "react";
import { MAX_AGE, MIN_AGE } from "@/lib/profile-options";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const daysIn = (y: number, m: number) => new Date(Date.UTC(y || 2000, m, 0)).getUTCDate(); // m: 1–12; tahun kabisat bila tahun belum dipilih

/**
 * Tanggal lahir dengan tiga pilihan (tanggal, bulan, tahun) tanpa mengetik. Rentang tahun dibatasi usia 17–100 tahun.
 * `value` berformat YYYY-MM-DD ('' bila belum lengkap); `onChange` dipanggil dengan tanggal lengkap atau ''.
 */
export default function BirthDateSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const now = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => now - MIN_AGE - i), [now]);
  const [py, pm, pd] = value ? value.split("-").map(Number) : [0, 0, 0];
  const [y, setY] = useState(py || 0), [m, setM] = useState(pm || 0), [d, setD] = useState(pd || 0);

  function emit(ny: number, nm: number, nd: number) {
    setY(ny); setM(nm); setD(nd);
    if (!ny || !nm || !nd) return onChange("");
    const day = Math.min(nd, daysIn(ny, nm));
    onChange(`${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }

  const maxDay = m ? daysIn(y, m) : 31;
  return (
    <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2" role="group" aria-labelledby={`${id}-l`}>
      <select id={`${id}-d`} aria-label="Tanggal" className="input" value={d || ""} onChange={(e) => emit(y, m, Number(e.target.value))}>
        <option value="">Tgl</option>{Array.from({ length: maxDay }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <select id={`${id}-m`} aria-label="Bulan" className="input" value={m || ""} onChange={(e) => emit(y, Number(e.target.value), Math.min(d, daysIn(y, Number(e.target.value))))}>
        <option value="">Bulan</option>{MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <select id={`${id}-y`} aria-label="Tahun" className="input" value={y || ""} onChange={(e) => emit(Number(e.target.value), m, d)}>
        <option value="">Tahun</option>{years.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}
