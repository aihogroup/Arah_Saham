"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Delta, Empty, Skeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { price } from "@/lib/format";

type Item = { stock_code: string; name: string; close: number | null; change_pct: number | null };

export default function WatchlistView() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: w } = await sb.from("watchlists").select("stock_code").order("created_at");
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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,6}$/.test(c)) return setErr("Kode saham tidak valid.");
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("watchlists").insert({ user_id: u.user!.id, stock_code: c });
    if (error) return setErr(error.code === "23503" ? "Kode saham tidak ditemukan." : error.code === "23505" ? "Sudah ada di watchlist." : "Gagal menambah.");
    setErr(null); setCode(""); load();
  }
  async function remove(c: string) { await createClient().from("watchlists").delete().eq("stock_code", c); load(); }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2">
        <label htmlFor="wc" className="sr-only">Kode saham</label>
        <input id="wc" className="input max-w-[200px] uppercase" placeholder="Kode, mis. BBCA" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
        <button className="btn btn-primary">Tambah</button>
      </form>
      {err && <p role="alert" className="down">{err}</p>}
      {!items ? <Skeleton className="h-40" /> : items.length === 0 ? <Empty message="Watchlist masih kosong." /> : (
        <table className="data"><thead><tr><th>Kode</th><th className="hidden sm:table-cell">Nama</th><th className="r">Harga</th><th className="r">Perubahan</th><th><span className="sr-only">Hapus</span></th></tr></thead>
          <tbody>{items.map((i) => (
            <tr key={i.stock_code}><td><Link href={`/saham/${i.stock_code}`} className="font-medium text-brand">{i.stock_code}</Link></td>
              <td className="hidden sm:table-cell">{i.name}</td><td className="r">{i.close === null ? "–" : price(i.close)}</td><td className="r"><Delta value={i.change_pct} /></td>
              <td className="r"><button className="text-muted underline" onClick={() => remove(i.stock_code)} aria-label={`Hapus ${i.stock_code}`}>Hapus</button></td></tr>
          ))}</tbody></table>
      )}
    </div>
  );
}
