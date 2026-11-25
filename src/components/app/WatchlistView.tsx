"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, RotateCcw, Star, Trash2 } from "lucide-react";
import { toast } from "@/components/Toaster";
import { Delta, Empty, Field, Skeleton, fieldAria } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { price } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { normalize } from "@/lib/validation";

type Item = { stock_code: string; name: string; close: number | null; change_pct: number | null };

/**
 * Watchlist: tambah dengan kode saham (huruf kecil, "$BBCA", "BBCA.JK" diterima), hapus langsung tanpa dialog
 * karena bisa diurungkan dari notifikasi (UI optimistis + Urungkan lebih cepat daripada konfirmasi).
 */
export default function WatchlistView() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: w, error } = await sb.from("watchlists").select("stock_code").order("created_at");
    if (error) { setLoadErr(true); return; }
    setLoadErr(false);
    const codes = (w ?? []).map((x) => x.stock_code);
    if (!codes.length) return setItems([]);
    const [{ data: names }, { data: last }] = await Promise.all([
      sb.from("dim_stock").select("code,name").in("code", codes),
      sb.from("fact_stock_daily").select("stock_code,close,change_pct,trade_date").in("stock_code", codes).order("trade_date", { ascending: false }).limit(codes.length * 2),
    ]);
    const nm = new Map((names ?? []).map((n) => [n.code, n.name]));
    const lp = new Map<string, { close: number; change_pct: number | null }>();
    for (const r of last ?? []) if (!lp.has(r.stock_code)) lp.set(r.stock_code, { close: Number(r.close), change_pct: r.change_pct === null ? null : Number(r.change_pct) });
    setItems(codes.map((c) => ({ stock_code: c, name: nm.get(c) ?? c, close: lp.get(c)?.close ?? null, change_pct: lp.get(c)?.change_pct ?? null })));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function insert(c: string) {
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    return sb.from("watchlists").insert({ user_id: u.user!.id, stock_code: c });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // cegah kirim ganda
    const c = normalize.stockCode(code);
    if (!/^[A-Z0-9]{3,6}$/.test(c)) return setErr("Kode saham 3–6 huruf/angka, mis. BBCA.");
    setBusy(true);
    const { error } = await insert(c);
    setBusy(false);
    if (error) return setErr(error.code === "23503" ? `Kode ${c} tidak ditemukan di bursa.` : error.code === "23505" ? `${c} sudah ada di watchlist.` : "Gagal menambah. Coba lagi.");
    setErr(null); setCode(""); haptic("success"); toast(`${c} ditambahkan ke watchlist`); load();
  }

  async function remove(it: Item) {
    const prev = items;
    setItems((x) => x?.filter((i) => i.stock_code !== it.stock_code) ?? null); // langsung hilang (optimistis)
    const { error } = await createClient().from("watchlists").delete().eq("stock_code", it.stock_code);
    if (error) { setItems(prev); toast(`Gagal menghapus ${it.stock_code}. Coba lagi.`, "error"); return; }
    haptic("tap");
    toast(`${it.stock_code} dihapus dari watchlist`, "info", {
      label: "Urungkan",
      onClick: async () => { const r = await insert(it.stock_code); if (r.error) toast("Gagal mengembalikan.", "error"); else load(); },
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex items-start gap-2" noValidate>
        <div className="w-full max-w-[240px]">
          <Field id="wc" label={<span className="sr-only">Kode saham</span>} error={err}>
            <input {...fieldAria("wc", err)} className="input uppercase" placeholder="Kode, mis. BBCA" value={code} autoCapitalize="characters" autoComplete="off" spellCheck={false}
              enterKeyHint="done" maxLength={10} onChange={(e) => { setCode(e.target.value); if (err) setErr(null); }} />
          </Field>
        </div>
        <button className="btn btn-primary mt-6" disabled={busy || !code.trim()} aria-busy={busy}>{!busy && <Plus size={18} aria-hidden="true" />}{busy ? "Menambah…" : "Tambah"}</button>
      </form>

      {loadErr ? (
        <div role="alert" className="card flex flex-wrap items-center justify-between gap-3">
          <p className="down">Watchlist belum bisa dimuat.</p>
          <button type="button" className="btn" onClick={load}><RotateCcw size={16} aria-hidden="true" />Coba lagi</button>
        </div>
      ) : !items ? (
        <div className="space-y-2" role="status" aria-label="Memuat watchlist">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : items.length === 0 ? (
        <Empty icon={<Star size={22} />} title="Watchlist masih kosong" message="Ketik kode saham di atas untuk mulai memantau harganya di sini setiap hari."
          action={<Link href="/saham" className="btn">Jelajahi saham</Link>} />
      ) : (
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>Kode</th><th className="hidden sm:table-cell">Nama</th><th className="r">Harga</th><th className="r">Perubahan</th><th className="w-12"><span className="sr-only">Aksi</span></th></tr></thead>
            <tbody>{items.map((i) => (
              <tr key={i.stock_code}>
                <td><Link href={`/saham/${i.stock_code}`} className="inline-flex min-h-10 items-center font-medium text-brand">{i.stock_code}</Link></td>
                <td className="hidden sm:table-cell">{i.name}</td>
                <td className="r">{i.close === null ? "–" : price(i.close)}</td>
                <td className="r"><Delta value={i.change_pct} /></td>
                <td className="r"><button type="button" className="btn btn-ghost btn-icon text-muted hover:text-down" onClick={() => remove(i)} aria-label={`Hapus ${i.stock_code} dari watchlist`} title="Hapus"><Trash2 size={18} aria-hidden="true" /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
