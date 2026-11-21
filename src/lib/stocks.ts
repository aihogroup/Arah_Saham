// Tipe dan pemeta data saham yang aman dipakai di server maupun klien (tanpa impor server-only).

export type GroupRow = { stock_code: string; name: string; sector: string | null; board: string | null; close: number; change_pct: number | null; value: number; spark: number[] | null };

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export const toGroupRow = (r: Record<string, unknown>): GroupRow => ({
  stock_code: r.stock_code as string, name: r.name as string, sector: (r.sector as string) ?? null, board: (r.board as string) ?? null,
  close: Number(r.close), change_pct: n(r.change_pct), value: Number(r.value), spark: r.spark ? (r.spark as unknown[]).map(Number) : null,
});
