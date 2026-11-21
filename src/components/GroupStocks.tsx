"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { T, useT } from "@/components/T";
import { Delta, Empty, Locked, Sparkline } from "@/components/ui";
import { useSignedIn } from "@/components/useSignedIn";
import { cached, rpcData } from "@/lib/client-cache";
import { compact, price } from "@/lib/format";
import { toGroupRow, type GroupRow } from "@/lib/stocks";
import { createClient } from "@/lib/supabase/client";

type SortKey = "stock_code" | "close" | "change_pct" | "value";

/** Anggota satu kelompok saham. Pengunjung melihat 10 teratas (dari server); akun melihat seluruhnya, dapat dicari dan diurutkan. */
export default function GroupStocks({ kind, value, initial }: { kind: "sektor" | "papan" | "indeks"; value: string; initial: GroupRow[] }) {
  const t = useT();
  const signedIn = useSignedIn();
  const [rows, setRows] = useState<GroupRow[]>(initial);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "value", asc: false });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    cached(`grp:${kind}:${value}`, () => rpcData<Record<string, unknown>[]>(createClient().rpc("group_stocks", { p_kind: kind, p_value: value, p_limit: 500 })), 3 * 60_000)
      .then((r) => { if (live) { setRows((r ?? []).map(toGroupRow)); setErr(null); } })
      .catch(() => { if (live) setErr("Gagal memuat daftar saham. Coba lagi."); });
    return () => { live = false; };
  }, [signedIn, kind, value]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? rows.filter((r) => r.stock_code.toLowerCase().startsWith(needle) || r.name.toLowerCase().includes(needle)) : rows;
    const dir = sort.asc ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av === null || av === undefined) return 1; // NULL selalu di akhir
      if (bv === null || bv === undefined) return -1;
      return (typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * dir;
    });
  }, [rows, q, sort]);

  const th = (key: SortKey, label: React.ReactNode, cls = "") => (
    <th className={cls} aria-sort={sort.key === key ? (sort.asc ? "ascending" : "descending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 font-medium hover:text-foreground" onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : key === "stock_code" }))}>
        {label}<span aria-hidden="true">{sort.key === key ? (sort.asc ? "↑" : "↓") : ""}</span>
      </button>
    </th>
  );

  if (rows.length === 0 && signedIn !== null) return <Empty message={t("stocks.empty")} />;
  return (
    <div>
      {signedIn && <div className="mb-3"><label className="sr-only" htmlFor="cari-grup">Cari saham</label><input id="cari-grup" className="input max-w-xs" placeholder="Cari kode atau nama" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
      <div className="overflow-x-auto">
        <table className="data">
          <thead><tr>
            {th("stock_code", <T k="col.code" />)}<th className="hidden sm:table-cell"><T k="col.name" /></th>
            {th("close", <T k="col.price" />, "r")}{th("change_pct", <T k="col.change" />, "r")}{th("value", <T k="col.value" />, "r hidden md:table-cell")}
            <th className="r hidden md:table-cell"><span className="sr-only"><T k="col.trend" /></span></th>
          </tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.stock_code}>
                <td><Link className="font-medium text-brand" href={`/saham/${r.stock_code}`}>{r.stock_code}</Link></td>
                <td className="hidden max-w-[280px] truncate sm:table-cell">{r.name}</td>
                <td className="r">{price(r.close)}</td><td className="r"><Delta value={r.change_pct} /></td>
                <td className="r hidden md:table-cell">{compact(r.value)}</td>
                <td className="r hidden md:table-cell"><Sparkline data={r.spark} width={64} height={22} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {err && <p role="alert" className="mt-2 down">{err}</p>}
      {signedIn === false && <div className="mt-4"><Locked text={t("stocks.lockedGroup")} href="/daftar" cta={t("auth.signup")} /></div>}
    </div>
  );
}
