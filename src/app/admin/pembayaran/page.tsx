import { PageHead } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { idr } from "@/lib/format";

export const metadata = { title: "Pembayaran" };

export default async function AdminPembayaran() {
  const sb = await createClient();
  const [{ data: orders }, { data: events }] = await Promise.all([
    sb.from("orders").select("order_id,plan_id,gross_amount,status,payment_type,created_at,paid_at").order("created_at", { ascending: false }).limit(50),
    sb.from("payment_events").select("id,order_id,transaction_status,signature_ok,received_at").order("received_at", { ascending: false }).limit(30),
  ]);
  return (
    <div className="space-y-6">
      <PageHead title="Pembayaran" lead="Pesanan dan notifikasi Midtrans terbaru." />
      <div className="overflow-x-auto"><table className="data"><thead><tr><th>Pesanan</th><th>Paket</th><th className="r">Jumlah</th><th>Status</th><th>Metode</th><th>Dibuat</th></tr></thead>
        <tbody>{(orders ?? []).map((o) => <tr key={o.order_id}><td>{o.order_id}</td><td>{o.plan_id}</td><td className="r">{idr(o.gross_amount)}</td><td className={o.status === "paid" ? "up" : ""}>{o.status}</td><td>{o.payment_type ?? "–"}</td><td>{new Date(o.created_at).toLocaleString("id-ID")}</td></tr>)}</tbody></table></div>
      <section><h2 className="mb-2 text-lg">Notifikasi webhook</h2>
        <div className="overflow-x-auto"><table className="data"><thead><tr><th>Waktu</th><th>Pesanan</th><th>Status</th><th>Tanda tangan</th></tr></thead>
          <tbody>{(events ?? []).map((e) => <tr key={e.id}><td>{new Date(e.received_at).toLocaleString("id-ID")}</td><td>{e.order_id}</td><td>{e.transaction_status}</td><td className={e.signature_ok ? "up" : "down"}>{e.signature_ok ? "✓ sah" : "✗ tidak sah"}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
