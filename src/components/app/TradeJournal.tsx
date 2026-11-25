"use client";

import { Trash2 } from "lucide-react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/Toaster";
import { cached, invalidate, rpcData } from "@/lib/client-cache";
import { dateId, idr } from "@/lib/format";
import type { Trade } from "@/lib/beranda";
import { createClient } from "@/lib/supabase/client";

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const SRC: Record<string, string> = { saldo_awal: "Saldo awal", rekomendasi: "Dari rekomendasi", manual: "" };

/** Formulir catat transaksi. Dipakai inline di kartu rekomendasi/portofolio (kode terisi) dan di jurnal (kode bebas). */
export function TradeForm({ code, side, defaultPrice, source = "manual", onDone, onCancel }: {
  code?: string; side: "buy" | "sell"; defaultPrice?: number | null; source?: "manual" | "rekomendasi"; onDone: () => void; onCancel?: () => void;
}) {
  const [c, setC] = useState(code ?? "");
  const [sd, setSd] = useState(side);
  const [lots, setLots] = useState("");
  const [price, setPrice] = useState(defaultPrice ? String(defaultPrice) : "");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const l = Math.floor(Number(lots)), p = Number(price.replace(",", "."));
    if (!c.trim() || !(l > 0) || !(p > 0)) return setErr("Isi kode saham, jumlah lot, dan harga dengan benar.");
    setBusy(true); setErr(null);
    const { error } = await createClient().rpc("add_trade", { p_code: c.trim().toUpperCase(), p_side: sd, p_lots: l, p_price: p, p_date: date, p_note: note || null, p_source: source });
    setBusy(false);
    if (error) return setErr(error.message.length < 120 ? error.message : "Gagal mencatat transaksi.");
    invalidate("home"); invalidate("trades");
    toast(sd === "buy" ? "Pembelian dicatat" : "Penjualan dicatat");
    setLots(""); setNote("");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-line bg-surface p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr]">
        {!code && (
          <label className="text-meta">Kode<input className="input mt-1 uppercase" value={c} maxLength={8} onChange={(e) => setC(e.target.value)} placeholder="BBCA" /></label>
        )}
        {!code && (
          <label className="text-meta">Aksi<select className="input mt-1" value={sd} onChange={(e) => setSd(e.target.value as "buy" | "sell")}><option value="buy">Beli</option><option value="sell">Jual</option></select></label>
        )}
        <label className="text-meta">Lot<input className="input mt-1" inputMode="numeric" value={lots} onChange={(e) => setLots(e.target.value.replace(/\D/g, ""))} placeholder="mis. 5" /></label>
        <label className="text-meta">Harga<input className="input mt-1" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="per lembar" /></label>
        <label className="text-meta">Tanggal<input className="input mt-1" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <label className="block text-meta">Catatan (opsional)<input className="input mt-1" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Alasan atau rencana, mis. target jual 6.000" /></label>
      {err && <p role="alert" className="text-meta down">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Menyimpan…" : sd === "buy" ? "Catat pembelian" : "Catat penjualan"}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Batal</button>}
      </div>
    </form>
  );
}

/** Jurnal aksi: riwayat pembelian dan penjualan yang dicatat pengguna. */
export default function TradeJournal({ version, onChange }: { version: number; onChange: () => void }) {
  const [rows, setRows] = useState<Trade[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    cached("trades", () => rpcData<Trade[]>(createClient().rpc("my_trades", { p_limit: 50 })), 30_000)
      .then((r) => setRows(r ?? [])).catch(() => setErr("Gagal memuat jurnal."));
  }, []);
  useEffect(() => { load(); }, [load, version]);

  async function del(id: string) {
    if (!(await confirmDialog({ title: "Hapus catatan transaksi?", message: "Posisi dan untung-rugi portofolio akan dihitung ulang tanpa transaksi ini.", confirmLabel: "Hapus catatan", tone: "danger" }))) return;
    const { error } = await createClient().rpc("delete_trade", { p_id: id });
    if (error) return toast("Gagal menghapus catatan. Coba lagi.", "error");
    invalidate("home"); invalidate("trades"); toast("Catatan dihapus"); onChange();
  }

  return (
    <section className="card space-y-3" aria-labelledby="h-jurnal">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="h-jurnal" className="text-lg">Jurnal aksi saya</h2>
        {!adding && <button type="button" className="btn" onClick={() => setAdding(true)}>+ Catat transaksi</button>}
      </div>
      {adding && <TradeForm side="buy" onDone={() => { setAdding(false); onChange(); }} onCancel={() => setAdding(false)} />}
      {err && <p role="alert" className="down">{err}</p>}
      {!rows && !err && <div className="space-y-2" role="status" aria-label="Memuat jurnal">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11" />)}</div>}
      {rows && rows.length === 0 && <p className="text-sm text-muted">Belum ada catatan. Catat pembelian atau penjualan Anda agar saran portofolio memperhitungkannya.</p>}
      {rows && rows.length > 0 && (
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>Tanggal</th><th>Saham</th><th>Aksi</th><th className="r">Lot</th><th className="r">Harga</th><th><span className="sr-only">Hapus</span></th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{dateId(t.traded_on, { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td><Link href={`/saham/${t.stock_code}`} className="font-medium text-brand">{t.stock_code}</Link>{(SRC[t.source] || t.note) && <span className="block text-caption text-muted">{[SRC[t.source], t.note].filter(Boolean).join(" · ")}</span>}</td>
                  <td className={t.side === "buy" ? "up" : "down"}>{t.side === "buy" ? "Beli" : "Jual"}</td>
                  <td className="r">{t.lots.toLocaleString("id-ID")}</td>
                  <td className="r">{idr(Number(t.price))}</td>
                  <td className="r"><button type="button" className="btn btn-ghost btn-icon text-muted hover:text-down" aria-label={`Hapus catatan ${t.stock_code} ${dateId(t.traded_on)}`} title="Hapus" onClick={() => del(t.id)}><Trash2 size={18} aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
