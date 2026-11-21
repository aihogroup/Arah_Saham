import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { mapStatus, verifySignature } from "@/lib/midtrans";

type Notif = {
  order_id?: string; status_code?: string; gross_amount?: string; signature_key?: string;
  transaction_status?: string; fraud_status?: string; payment_type?: string;
};

/** Webhook Midtrans. Idempoten: event yang sama (order, status, kode) hanya diproses sekali. */
export async function POST(req: Request) {
  const n = (await req.json().catch(() => null)) as Notif | null;
  if (!n?.order_id || !n.transaction_status) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const ok = verifySignature(n, process.env.MIDTRANS_SERVER_KEY ?? "");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const admin = adminClient();

  // semua notifikasi dicatat (termasuk yang tanda tangannya tidak sah) untuk audit
  const { error: evErr } = await admin.from("payment_events").insert({
    order_id: n.order_id, transaction_status: n.transaction_status, status_code: n.status_code ?? "",
    fraud_status: n.fraud_status ?? null, gross_amount: n.gross_amount ?? null, signature_ok: ok, payload: n,
  });
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  if (evErr) {
    if (evErr.code === "23505") return NextResponse.json({ ok: true, duplicate: true }); // sudah diproses
    return NextResponse.json({ error: "db" }, { status: 500 }); // Midtrans akan mencoba lagi
  }

  const { data: order } = await admin.from("orders").select("order_id,user_id,plan_id,gross_amount,status").eq("order_id", n.order_id).maybeSingle();
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });
  // nominal harus cocok dengan pesanan
  if (n.gross_amount && Math.round(Number(n.gross_amount)) !== order.gross_amount) return NextResponse.json({ error: "amount mismatch" }, { status: 409 });

  const status = mapStatus(n.transaction_status, n.fraud_status);
  if (order.status === "paid" && status !== "refunded") return NextResponse.json({ ok: true });

  await admin.from("orders").update({ status, payment_type: n.payment_type ?? null, ...(status === "paid" ? { paid_at: new Date().toISOString() } : {}) }).eq("order_id", order.order_id);

  if (status === "paid") {
    const { data: plan } = await admin.from("plans").select("duration_days").eq("id", order.plan_id).single();
    const days = plan?.duration_days ?? 30;
    // perpanjang dari akhir langganan aktif bila ada
    const { data: cur } = await admin.from("subscriptions").select("ends_at").eq("user_id", order.user_id).eq("status", "active").gt("ends_at", new Date().toISOString()).order("ends_at", { ascending: false }).limit(1).maybeSingle();
    const start = cur ? new Date(cur.ends_at) : new Date();
    const ends = new Date(start.getTime() + days * 86_400_000);
    await admin.from("subscriptions").insert({ user_id: order.user_id, plan_id: order.plan_id, source: "midtrans", starts_at: new Date().toISOString(), ends_at: ends.toISOString(), order_id: order.order_id });
  } else if (status === "refunded") {
    await admin.from("subscriptions").update({ status: "cancelled" }).eq("order_id", order.order_id);
  }
  return NextResponse.json({ ok: true });
}
