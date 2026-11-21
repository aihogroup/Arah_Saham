const idNum = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const idInt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export const num = (v: number | string | null | undefined, digits = 2) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? "–"
    : new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(v));
export const int = (v: number | string | null | undefined) =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? "–" : idInt.format(Number(v));
export const price = (v: number | string | null | undefined) =>
  v === null || v === undefined ? "–" : idNum.format(Number(v));

/** Ringkas angka besar: 1,2 T / 340 M / 5 jt */
export function compact(v: number | string | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "–";
  const n = Number(v);
  const a = Math.abs(n);
  const f = (x: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(x);
  if (a >= 1e12) return `${f(n / 1e12)} T`;
  if (a >= 1e9) return `${f(n / 1e9)} M`;
  if (a >= 1e6) return `${f(n / 1e6)} jt`;
  return f(n);
}

export const idr = (v: number) => "Rp" + idInt.format(v);

export function pct(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "–";
  const n = Number(v);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(n))}%`;
}

export const dir = (v: number | string | null | undefined): "up" | "down" | "flat" => {
  const n = Number(v);
  return !Number.isFinite(n) || n === 0 ? "flat" : n > 0 ? "up" : "down";
};

export function dateId(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  if (!d) return "–";
  const dt = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00+07:00" : d) : d;
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", ...opts }).format(dt);
}
