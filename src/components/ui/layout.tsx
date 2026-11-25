// Molekul tata letak halaman: judul halaman, bagian, remah roti, cap tanggal data.
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { dateId } from "@/lib/format";
import { DISCLAIMER } from "@/lib/labels";

/** Bagian halaman pemasaran: judul, pengantar opsional, slot aksi di kanan. */
export function Section({ title, lead, action, children, id }: { title: string; lead?: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="section" aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="container-x">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="measure">
            <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
            {lead && <p className="mt-2 text-muted">{lead}</p>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

export type Crumb = { href?: string; label: string };

/** Remah roti: posisi pengguna dalam struktur situs. Item terakhir = halaman ini (tanpa tautan). */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Remah roti" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-meta text-muted">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="inline-flex items-center gap-1">
              {c.href && !last
                ? <Link href={c.href} className="inline-flex min-h-[32px] items-center hover:text-foreground hover:underline">{c.label}</Link>
                : <span aria-current={last ? "page" : undefined} className={last ? "text-foreground" : undefined}>{c.label}</span>}
              {!last && <ChevronRight size={14} aria-hidden="true" className="flip-rtl" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Kepala halaman: satu h1 per halaman, pengantar, cap tanggal, dan slot aksi. */
export function PageHead({ title, lead, stamp, action, crumbs }: { title: ReactNode; lead?: ReactNode; stamp?: string | null; action?: ReactNode; crumbs?: Crumb[] }) {
  return (
    <div className="mb-6">
      {crumbs && crumbs.length > 0 && <Breadcrumb items={crumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1>{title}</h1>
          {lead && <p className="mt-2 measure text-muted">{lead}</p>}
          {stamp !== undefined && <Stamp date={stamp} />}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

/** Tanggal data: pengguna selalu tahu seberapa segar angka yang dilihatnya. */
export function Stamp({ date, demo }: { date: string | null | undefined; demo?: boolean }) {
  return (
    <p className="mt-2 text-meta text-muted">
      Data per {date ? <time dateTime={date}>{dateId(date)}</time> : "–"}{demo ? " · DATA DEMO (sintetis, bukan data pasar sebenarnya)" : ""}
    </p>
  );
}

export function Disclaimer({ className = "" }: { className?: string }) {
  return <p className={`text-meta text-muted ${className}`}>{DISCLAIMER}</p>;
}
