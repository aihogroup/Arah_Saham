import Link from "next/link";
import { PageHead } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DATA_GROUPS, MAX_PAGE, PAGE_SIZE, cell, findSet, type DataPage } from "@/lib/admin-data";

export const metadata = { title: "Data tersimpan" };

type SP = { set?: string; q?: string; dari?: string; sampai?: string; hal?: string };
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export default async function DataPageRoute({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const set = findSet(sp.set);
  const q = (sp.q ?? "").slice(0, 40);
  const from = set.dated ? isDate(sp.dari) : "";
  const to = set.dated ? isDate(sp.sampai) : "";
  const page = Math.min(Math.max(Number.parseInt(sp.hal ?? "1", 10) || 1, 1), MAX_PAGE);

  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_data", { p_set: set.id, p_from: from || null, p_to: to || null, p_q: q || null, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE });
  const d = data as DataPage | null;
  const pages = d ? Math.max(Math.ceil(d.total / PAGE_SIZE), 1) : 1;

  const href = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const m = { set: set.id, q, dari: from, sampai: to, hal: String(page), ...over };
    for (const [k, v] of Object.entries(m)) if (v && !(k === "hal" && v === "1")) p.set(k, v);
    return `/admin/data?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <PageHead title="Data tersimpan" lead="Jelajahi data yang tersimpan di database dalam bentuk tabel. Hanya baca." />

      <div className="space-y-3">
        {DATA_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-1 text-caption font-semibold uppercase tracking-wider text-muted">{g.title}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={g.title}>
              {g.sets.map((s) => <Link key={s.id} href={`/admin/data?set=${s.id}`} className="chip" aria-pressed={s.id === set.id}>{s.label}</Link>)}
            </div>
          </div>
        ))}
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-3" action="/admin/data">
        <input type="hidden" name="set" value={set.id} />
        <label className="grid gap-1 text-meta font-medium text-muted">Cari kode
          <input name="q" defaultValue={q} className="input !h-10 !min-h-0 w-40 py-0" placeholder="mis. BBCA" />
        </label>
        {set.dated && <>
          <label className="grid gap-1 text-meta font-medium text-muted">Dari tanggal
            <input type="date" name="dari" defaultValue={from} className="input !h-10 !min-h-0 w-auto py-0" />
          </label>
          <label className="grid gap-1 text-meta font-medium text-muted">Sampai tanggal
            <input type="date" name="sampai" defaultValue={to} className="input !h-10 !min-h-0 w-auto py-0" />
          </label>
        </>}
        <button className="btn">Terapkan</button>
        {(q || from || to) && <Link href={`/admin/data?set=${set.id}`} className="btn btn-ghost">Atur ulang</Link>}
      </form>

      <p className="text-meta text-muted" role="status">
        <strong className="font-medium text-foreground">{set.label}</strong> · {set.hint}
        {d && <> · {d.approx ? "sekitar " : ""}{d.total.toLocaleString("id-ID")} baris{d.total > 0 && <>, halaman {page} dari {d.approx ? "±" : ""}{pages.toLocaleString("id-ID")}</>}</>}
      </p>

      {error || !d ? <p role="alert" className="down">Gagal memuat data. Coba lagi.</p> : (
        <div className="table-scroll">
          <table className="data">
            <thead><tr>{d.columns.map((c) => <th key={c} className="whitespace-nowrap">{c}</th>)}</tr></thead>
            <tbody>
              {d.rows.map((r, i) => <tr key={i}>{d.columns.map((c) => <td key={c} className="whitespace-nowrap">{cell(r[c])}</td>)}</tr>)}
            </tbody>
          </table>
          {d.rows.length === 0 && <p className="py-6 text-center text-muted">Tidak ada data yang cocok.</p>}
        </div>
      )}

      {d && d.total > PAGE_SIZE && (
        <nav className="flex items-center justify-between gap-2" aria-label="Halaman">
          {page > 1 ? <Link href={href({ hal: String(page - 1) })} className="btn">← Sebelumnya</Link> : <span />}
          <span className="text-meta text-muted">Halaman {page}</span>
          {page < pages && page < MAX_PAGE ? <Link href={href({ hal: String(page + 1) })} className="btn">Berikutnya →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
