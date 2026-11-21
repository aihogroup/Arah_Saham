import Link from "next/link";
import { Banner, PageHead } from "@/components/ui";
import ProfileForm from "@/components/app/ProfileForm";
import RiskQuiz from "@/components/app/RiskQuiz";
import ForecastModeForm from "@/components/app/ForecastModeForm";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dateId, idr } from "@/lib/format";

export const metadata = { title: "Akun", robots: { index: false } };

export default async function AkunPage({ searchParams }: { searchParams: Promise<{ bayar?: string }> }) {
  const a = await requireUser("/akun");
  const { bayar } = await searchParams;
  const sb = await createClient();
  const [{ data: prof }, { data: subs }, { data: orders }] = await Promise.all([
    sb.from("profiles").select("forecast_mode,username,birth_date,occupation,income_range,risk_score,risk_assessed_at,daily_loss_limit_pct,experience_years,trading_style").eq("id", a.userId!).maybeSingle(),
    sb.from("subscriptions").select("source,plan_id,starts_at,ends_at,status").eq("user_id", a.userId!).order("ends_at", { ascending: false }).limit(5),
    sb.from("orders").select("order_id,plan_id,gross_amount,status,created_at").eq("user_id", a.userId!).order("created_at", { ascending: false }).limit(10),
  ]);
  const active = (subs ?? []).find((s) => s.status === "active" && new Date(s.ends_at) > new Date());

  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <PageHead title="Akun" lead={a.email ?? ""} />
      {bayar === "sukses" && <Banner level="info">Pembayaran diterima. Premium aktif setelah konfirmasi Midtrans (biasanya beberapa detik).</Banner>}
      {bayar === "menunggu" && <Banner level="warning">Menunggu pembayaran Anda. Status akan diperbarui otomatis.</Banner>}

      <section className="card" aria-labelledby="h-langganan">
        <h2 id="h-langganan" className="text-lg">Langganan</h2>
        {a.isAdmin ? <p className="mt-2">Anda admin: seluruh fitur Premium terbuka.</p>
          : active ? <p className="mt-2"><strong>Premium aktif</strong> ({active.source === "trial" ? "uji coba" : "berbayar"}) sampai {dateId(active.ends_at)}.</p>
          : <p className="mt-2">Paket <strong>Gratis</strong>. <Link href="/harga" className="text-brand underline">Lihat paket Premium</Link></p>}
        {orders && orders.length > 0 && (
          <div className="mt-4 overflow-x-auto"><table className="data">
            <thead><tr><th>Pesanan</th><th>Tanggal</th><th className="r">Jumlah</th><th>Status</th></tr></thead>
            <tbody>{orders.map((o) => <tr key={o.order_id}><td>{o.order_id}</td><td>{dateId(o.created_at)}</td><td className="r">{idr(o.gross_amount)}</td><td>{o.status}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>

      {a.isPremium
        ? <ForecastModeForm initial={prof?.forecast_mode === "dinamis" ? "dinamis" : "stabil"} />
        : <section className="card" aria-labelledby="h-mode"><h2 id="h-mode" className="text-lg">Mode data analisis pasar</h2><p className="mt-2 text-[14px] text-muted">Memilih antara data stabil dan data dinamis tersedia untuk Premium. <Link href="/harga" className="text-brand underline">Lihat paket Premium</Link></p></section>}

      <RiskQuiz score={prof?.risk_score ?? null} assessedAt={prof?.risk_assessed_at ?? null} />

      <ProfileForm initial={prof ?? {}} />
    </div>
  );
}
