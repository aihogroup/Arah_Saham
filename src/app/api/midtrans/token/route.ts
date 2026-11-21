import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { midtransBase } from "@/lib/midtrans";
import { rateLimitShared } from "@/lib/rate-limit";

const Body = z.object({ plan_id: z.string().min(1).max(40) });

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: claims } = await sb.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return NextResponse.json({ error: "Perlu login" }, { status: 401 });
  if (!(await rateLimitShared(`pay:${uid}`, 10, 60_000))) return NextResponse.json({ error: "Terlalu banyak percobaan" }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
  if (!serverKey || !clientKey) return NextResponse.json({ error: "Pembayaran belum dikonfigurasi" }, { status: 503 });

  // harga selalu dari database, tidak pernah dari browser
  const { data: plan } = await sb.from("plans").select("id,name,price_idr").eq("id", parsed.data.plan_id).eq("active", true).maybeSingle();
  if (!plan) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });

  const orderId = `AS-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const admin = adminClient();
  const { error: insErr } = await admin.from("orders").insert({ order_id: orderId, user_id: uid, plan_id: plan.id, gross_amount: plan.price_idr });
  if (insErr) return NextResponse.json({ error: "Gagal membuat pesanan" }, { status: 500 });

  const apiBase = process.env.MIDTRANS_IS_PRODUCTION === "true" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
  const res = await fetch(`${apiBase}/snap/v1/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: "Basic " + Buffer.from(serverKey + ":").toString("base64") },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: plan.price_idr },
      item_details: [{ id: plan.id, price: plan.price_idr, quantity: 1, name: plan.name }],
      customer_details: { email: claims?.claims?.email },
      credit_card: { secure: true },
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.token) {
    await admin.from("orders").update({ status: "failed" }).eq("order_id", orderId);
    return NextResponse.json({ error: "Midtrans menolak permintaan" }, { status: 502 });
  }
  await admin.from("orders").update({ snap_token: j.token }).eq("order_id", orderId);
  return NextResponse.json({ token: j.token, client_key: clientKey, snap_js: `${midtransBase()}/snap/snap.js`, order_id: orderId });
}
