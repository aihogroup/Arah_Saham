import Link from "next/link";
import { Suspense } from "react";
import { Database, ListChecks, Lock, Search, Sparkles } from "lucide-react";
import { MoverCard } from "@/components/MoverCard";
import { Delta, Disclaimer, Section, Skeleton, Sparkline, Stamp } from "@/components/ui";
import { getDataStatus, getOverview, getPlans, getPosts, getRanking } from "@/lib/data";
import { dateId, idr, int, num } from "@/lib/format";

export const metadata = { title: "Pahami arah pasar sebelum bursa dibuka" };

async function Hero() {
  const [o, st] = await Promise.all([getOverview(), getDataStatus()]);
  const b = o?.breadth;
  const total = b ? b.advancers + b.decliners + b.unchanged : 0;
  return (
    <div className="container-x grid items-center gap-8 py-12 lg:grid-cols-12 lg:py-16">
      <div className="lg:col-span-7">
        <h1>Pahami arah pasar sebelum bursa dibuka</h1>
        <p className="mt-4 max-w-xl text-muted">Data bursa dan pasar global dirangkum setiap hari, lalu disederhanakan menjadi kondisi pasar dan saham yang layak dipantau sesuai profil Anda.</p>
        <form action="/saham" className="mt-6 flex max-w-xl gap-2" role="search">
          <label htmlFor="q" className="sr-only">Cari saham</label>
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-4 text-muted" aria-hidden="true" />
            <input id="q" name="q" className="input !min-h-14 pl-10" placeholder="Cari kode atau nama saham, mis. BBCA" autoComplete="off" />
          </div>
          <button className="btn btn-primary !min-h-14" type="submit">Cari</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="self-center text-[13px] text-muted">Populer:</span>
          {["BBCA", "BBRI", "TLKM", "GOTO"].map((c) => <Link key={c} href={`/saham/${c}`} className="chip">{c}</Link>)}
        </div>
        <div className="mt-6"><Link href="/daftar" className="btn btn-primary">Daftar gratis</Link></div>
      </div>
      <div className="lg:col-span-5">
        <div className="card">
          <p className="text-[13px] text-muted">IHSG · penutupan</p>
          {o?.ihsg ? (
            <>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-[32px] font-semibold leading-10">{num(o.ihsg.close)}</span>
                <Delta value={o.ihsg.change_pct} />
              </div>
              <div className="mt-3"><Sparkline data={o.ihsg_spark} width={360} height={80} /></div>
              {b && total > 0 && (
                <div className="mt-4">
                  <div className="flex h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={`${b.advancers} naik, ${b.decliners} turun, ${b.unchanged} tetap`}>
                    <div style={{ width: `${(b.advancers / total) * 100}%`, background: "var(--up)" }} />
                    <div style={{ width: `${(b.decliners / total) * 100}%`, background: "var(--down)" }} />
                  </div>
                  <p className="mt-2 text-[13px] text-muted">{int(b.advancers)} naik · {int(b.decliners)} turun · {int(b.unchanged)} tetap</p>
                </div>
              )}
              <Stamp date={o.ihsg.date} demo={st?.demo} />
            </>
          ) : <p className="mt-2 text-muted">Data hari ini belum tersedia.</p>}
        </div>
      </div>
    </div>
  );
}

async function Movers() {
  const [g, l, v] = await Promise.all([getRanking("gainer", 5), getRanking("loser", 5), getRanking("value", 5)]);
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <MoverCard title="Top Gainer" rows={g} href="/peringkat?jenis=gainer" />
      <MoverCard title="Top Loser" rows={l} href="/peringkat?jenis=loser" />
      <MoverCard title="Top Value" rows={v} href="/peringkat?jenis=value" showValue />
    </div>
  );
}

async function Others() {
  const o = await getOverview();
  const pick = ["USDIDR=X", "GC=F", "^GSPC", "EIDO"];
  const list = (o?.others ?? []).filter((x) => pick.includes(x.symbol));
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {list.map((x) => (
        <div key={x.symbol} className="card !p-4" style={{ minHeight: 120 }}>
          <p className="text-[13px] text-muted">{x.name}</p>
          <p className="mt-1 text-[22px] font-semibold leading-7">{num(x.close, x.close > 1000 ? 0 : 2)}</p>
          <div className="mt-2 flex items-center justify-between"><Delta value={x.change_pct} /><Sparkline data={x.spark} width={56} height={22} /></div>
        </div>
      ))}
    </div>
  );
}

async function Pricing() {
  const plans = await getPlans();
  const monthly = plans.find((p) => p.id === "premium_monthly");
  const yearly = plans.find((p) => p.id === "premium_yearly");
  return (
    <div className="mx-auto grid max-w-[1000px] gap-6 md:grid-cols-2">
      <div className="card">
        <h3>Gratis</h3><p className="mt-2 text-[32px] font-semibold leading-10">Rp0</p>
        <ul className="mt-4 space-y-2 text-[15px]">
          {["Ringkasan pasar harian", "Data mentah lengkap setelah login", "Peringkat saham dan broker", "Watchlist sederhana", "Unduh CSV (kuota kecil)"].map((t) => <li key={t}>✓ {t}</li>)}
        </ul>
        <Link href="/daftar" className="btn mt-6 w-full">Daftar gratis</Link>
      </div>
      <div className="card border-brand">
        <div className="flex items-center justify-between"><h3>Premium</h3><span className="chip" data-active="true">Paling lengkap</span></div>
        <p className="mt-2 text-[32px] font-semibold leading-10">{monthly ? idr(monthly.price_idr) : "Rp79.000"}<span className="text-[15px] font-normal text-muted"> / bulan</span></p>
        {yearly && <p className="text-[13px] text-muted">atau {idr(yearly.price_idr)} per tahun (setara dua bulan gratis)</p>}
        <ul className="mt-4 space-y-2 text-[15px]">
          {["Kondisi pasar untuk besok", "Kandidat saham sesuai indeks & indikator pilihan", "Preset tersimpan", "Riwayat ketepatan sinyal rinci", "Kuota unduh CSV besar"].map((t) => <li key={t}>✓ {t}</li>)}
        </ul>
        <Link href="/harga" className="btn btn-primary mt-6 w-full">Coba premium 30 hari</Link>
      </div>
    </div>
  );
}

async function Posts() {
  const posts = (await getPosts(3));
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {posts.map((p) => (
        <Link key={p.slug} href={`/blog/${p.slug}`} className="card block hover:bg-surface">
          <div className="mb-4 aspect-video rounded-lg bg-brand-soft" aria-hidden="true" />
          <h3 className="text-[18px] leading-6">{p.title}</h3>
          <p className="mt-1 text-[13px] text-muted">{dateId(p.publish_at)}</p>
          <p className="mt-2 line-clamp-2 text-[15px] text-muted">{p.excerpt}</p>
        </Link>
      ))}
    </div>
  );
}

const FAQ = [
  ["Apakah Arah Saham memberi rekomendasi beli atau jual?", "Tidak. Kami menyajikan alat bantu analisis data. Keputusan investasi sepenuhnya milik Anda."],
  ["Seberapa akurat sinyalnya?", "Arah pasar harian sulit ditebak. Kami menampilkan riwayat ketepatan apa adanya, termasuk saat meleset, dan menyatakan tidak ada sinyal bila datanya tidak tegas."],
  ["Apa bedanya akun gratis dan premium?", "Akun gratis membuka data mentah lengkap. Premium menambahkan analisis personal: pilihan indeks dan indikator, kondisi pasar, dan kandidat saham."],
  ["Apakah saya bisa berhenti kapan saja?", "Ya. Setelah langganan berakhir akun kembali gratis dan preset Anda tetap tersimpan."],
  ["Bagaimana data pribadi saya diperlakukan?", "Kami hanya meminta data seperlunya, penghasilan disimpan sebagai rentang, dan Anda dapat menghapus akun kapan saja."],
];

export default function Home() {
  return (
    <>
      <Suspense fallback={<div className="container-x py-16"><Skeleton className="h-72" /></div>}><Hero /></Suspense>
      <Section title="Pasar hari ini" lead="Saham dengan pergerakan dan transaksi terbesar pada hari bursa terakhir.">
        <Suspense fallback={<Skeleton className="h-80" />}><Movers /></Suspense>
      </Section>
      <Section title="Pasar lain" lead="Kurs, komoditas, dan bursa global yang memengaruhi pembukaan IHSG.">
        <Suspense fallback={<Skeleton className="h-32" />}><Others /></Suspense>
      </Section>
      <Section title="Cara kerja" lead="Tiga langkah sederhana, tanpa istilah rumit.">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            [Database, "Kami kumpulkan data", "Data bursa dan pasar global dikumpulkan setiap hari."],
            [ListChecks, "Kami nilai konsistensinya", "Kami mempelajari pola mana yang selama ini sering sejalan dengan arah pasar."],
            [Sparkles, "Anda dapat ringkasannya", "Hasilnya diringkas menjadi sinyal harian yang mudah dibaca, sesuai profil Anda."],
          ].map(([Icon, t, d], i) => { const I = Icon as typeof Database; return (
            <div key={i} className="card"><I size={20} aria-hidden="true" className="text-brand" /><h3 className="mt-3">{t as string}</h3><p className="mt-2 text-muted">{d as string}</p></div>
          ); })}
        </div>
      </Section>
      <Section title="Cuplikan premium" lead="Contoh tampilan Analisis Saya. Data di bawah hanyalah contoh.">
        <div className="card relative overflow-hidden">
          <span className="chip absolute right-4 top-4" data-active="true">Contoh</span>
          <div aria-hidden="true" className="select-none opacity-60 blur-[3px]">
            <p className="text-[13px] text-muted">Kondisi pasar untuk besok</p>
            <p className="text-[28px] font-semibold">Cenderung naik · keyakinan sedang</p>
            <table className="data mt-4"><tbody>
              {["AAAA", "BBBB", "CCCC", "DDDD"].map((c, i) => <tr key={c}><td>{c}</td><td>Pantau</td><td className="r">{(0.4 - i * 0.07).toFixed(2)}</td></tr>)}
            </tbody></table>
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center"><Lock className="mx-auto" aria-hidden="true" /><Link className="btn btn-primary mt-3" href="/harga">Coba premium 30 hari</Link></div>
          </div>
        </div>
      </Section>
      <Section title="Harga" lead="Mulai gratis. Upgrade saat Anda butuh analisis personal."><Suspense fallback={<Skeleton className="h-72" />}><Pricing /></Suspense></Section>
      <Section title="Blog dan tanya jawab" action={<Link href="/blog" className="btn">Semua artikel</Link>}>
        <Suspense fallback={<Skeleton className="h-64" />}><Posts /></Suspense>
        <div className="mt-12 max-w-3xl">
          {FAQ.map(([q, a]) => (
            <details key={q} className="border-b border-line py-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-muted">{a}</p></details>
          ))}
        </div>
      </Section>
      <div className="container-x pb-12 text-center"><Link href="/daftar" className="btn btn-primary">Daftar gratis</Link><Disclaimer className="mt-4" /></div>
    </>
  );
}
