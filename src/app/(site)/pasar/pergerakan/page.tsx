import Link from "next/link";
import { Suspense } from "react";
import { Delta, Disclaimer, PageHead, Skeleton } from "@/components/ui";
import { getMovement, type MoveGroup, type MoveItem } from "@/lib/data";
import { dateId } from "@/lib/format";
import { rp } from "@/lib/beranda";
import { catByDb, mprice, symbolHref } from "@/lib/market";

export const metadata = {
  title: "Analisis pergerakan pasar",
  description: "Bagaimana pergerakan indeks global, kurs, komoditas, ETF/ADR, dan broker biasanya mendahului arah IHSG hari berikutnya.",
};

const ORDER = ["indeks_global", "kurs", "komoditas", "proksi_id", "proksi_saham"] as const;
const TITLE: Record<string, string> = { indeks_global: "Indeks global", kurs: "Kurs", komoditas: "Komoditas", proksi_id: "Proksi Indonesia", proksi_saham: "ETF dan ADR (proksi Indonesia)" };
const arrow = (d: string) => (d === "naik" ? "▲ condong naik" : "▼ condong turun");

function Row({ x }: { x: MoveItem }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <Link href={symbolHref(x.symbol)} className="font-medium hover:underline">{x.name}</Link>
        <p className="text-caption text-muted">{mprice(x.close)} · 1 hari <Delta value={x.chg_1d} className="!text-caption" /> · 5 hari <Delta value={x.chg_5d} className="!text-caption" /></p>
      </div>
      <div className="shrink-0 text-end">
        <span className={`text-sm font-medium ${x.signal === "naik" ? "up" : "down"}`}>{x.signal === "naik" ? "▲" : "▼"} IHSG {x.signal}</span>
        <p className="text-caption text-muted">pengaruh {x.strength}</p>
      </div>
    </li>
  );
}

function Group({ id, g }: { id: string; g: MoveGroup }) {
  const cat = catByDb(id);
  const top = g.items.slice(0, 5), rest = g.items.slice(5);
  return (
    <section className="card" aria-labelledby={`h-${id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`h-${id}`} className="text-xl leading-7">{TITLE[id] ?? id}</h2>
        <span className={`font-semibold ${g.direction === "naik" ? "up" : "down"}`}>{arrow(g.direction)}</span>
      </div>
      <p className="mt-1 text-meta text-muted">{g.supporting} dari {g.total} instrumen condong mendukung IHSG naik. Diurutkan dari yang paling berpengaruh hari ini.</p>
      <ul className="mt-2 divide-y divide-line">{top.map((x) => <Row key={x.symbol} x={x} />)}</ul>
      {rest.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-sm text-brand">Tampilkan {rest.length} lainnya</summary>
          <ul className="mt-1 divide-y divide-line">{rest.map((x) => <Row key={x.symbol} x={x} />)}</ul>
        </details>
      )}
      {cat && <p className="mt-2 text-meta"><Link href={`/pasar/${cat.slug}`} className="text-brand underline">Data lengkap {TITLE[id]?.toLowerCase()}</Link></p>}
    </section>
  );
}

async function Content() {
  const m = await getMovement();
  if (!m) return <p className="card text-muted">Data analisis pergerakan belum tersedia.</p>;
  const groups = ORDER.filter((k) => m.groups?.[k]);
  const ups = groups.filter((k) => m.groups[k].direction === "naik").length;
  const overall = ups * 2 >= groups.length ? "naik" : "turun";
  const b = m.broker;
  return (
    <>
      <section className="card" aria-labelledby="h-ringkas">
        <h2 id="h-ringkas" className="text-lg">Ringkasan hari ini</h2>
        <p className="mt-2 text-xl font-semibold leading-7"><span className={overall === "naik" ? "up" : "down"}>{arrow(overall)}</span>
          <span className="ms-2 text-sm font-normal text-muted">{ups} dari {groups.length} kelompok mendukung naik{m.ihsg ? ` · IHSG ${dateId(m.ihsg.date, { day: "numeric", month: "short" })}` : ""}</span></p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((k) => (
            <li key={k}><a href={`#h-${k}`} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 hover:border-brand">
              <span>{TITLE[k]}</span><span className={`text-sm font-medium ${m.groups[k].direction === "naik" ? "up" : "down"}`}>{m.groups[k].direction === "naik" ? "▲ naik" : "▼ turun"}</span>
            </a></li>
          ))}
          {b?.ratio != null && <li><a href="#h-broker" className="flex items-center justify-between rounded-lg border border-line px-3 py-2 hover:border-brand"><span>Aktivitas broker</span><span className="text-sm font-medium">{b.ratio >= 1 ? "▲ ramai" : "▼ sepi"}</span></a></li>}
        </ul>
        <p className="mt-3 text-meta text-muted">Cara membaca: untuk tiap instrumen, kami mengukur selama setahun terakhir seberapa konsisten pergerakannya hari sebelumnya sejalan atau berlawanan dengan IHSG keesokan harinya. Pergerakan terbaru lalu diterjemahkan menjadi arah. Ini hubungan historis, bukan sebab-akibat, dan sering lemah.</p>
      </section>

      {groups.map((k) => <Group key={k} id={k} g={m.groups[k]} />)}

      {b?.top && (
        <section className="card" aria-labelledby="h-broker">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="h-broker" className="text-xl leading-7">Pergerakan broker</h2>
            {b.date && <span className="text-meta text-muted">{dateId(b.date, { day: "numeric", month: "short", year: "numeric" })}</span>}
          </div>
          <p className="mt-1 text-sm">
            {b.ratio != null && <>Total transaksi broker <strong>{b.ratio >= 1 ? "di atas" : "di bawah"}</strong> rata-rata 30 hari ({b.ratio.toLocaleString("id-ID")}×). </>}
            {b.top5_share != null && <>Lima broker teratas menguasai <strong>{b.top5_share.toLocaleString("id-ID")}%</strong> nilai transaksi, {b.top5_share >= 45 ? "pasar cukup terkonsentrasi pada pemain besar." : "pasar relatif tersebar."}</>}
          </p>
          <div className="mt-3 table-scroll">
            <table className="data">
              <thead><tr><th>Broker</th><th className="r">Nilai</th><th className="r">Pangsa</th><th className="r">Dibanding rata-rata</th></tr></thead>
              <tbody>{b.top.map((x) => (
                <tr key={x.code}>
                  <td><span className="font-medium">{x.code}</span> <span className="text-caption text-muted">{x.name}</span></td>
                  <td className="r">{rp(x.value)}</td><td className="r">{x.share.toLocaleString("id-ID")}%</td>
                  <td className={`r ${x.ratio != null && x.ratio >= 1 ? "up" : "down"}`}>{x.ratio != null ? `${x.ratio >= 1 ? "▲" : "▼"} ${x.ratio.toLocaleString("id-ID")}×` : "–"}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <p className="mt-2 text-meta"><Link href="/broker" className="text-brand underline">Semua broker</Link></p>
        </section>
      )}
    </>
  );
}

export default function PergerakanPage() {
  return (
    <div className="container-x py-6 sm:py-8">
      <PageHead title="Analisis pergerakan pasar" lead="Pantau indeks global, kurs, komoditas, ETF/ADR, dan broker dalam satu halaman, lengkap dengan arah yang diisyaratkan untuk IHSG." />
      <div className="space-y-6"><Suspense fallback={<Skeleton className="h-96" />}><Content /></Suspense></div>
      <Disclaimer className="mt-6" />
    </div>
  );
}
