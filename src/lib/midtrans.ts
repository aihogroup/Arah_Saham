import { createHash, timingSafeEqual } from "node:crypto";

export const midtransBase = () =>
  process.env.MIDTRANS_IS_PRODUCTION === "true" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";

/** SHA-512(order_id + status_code + gross_amount + server_key) */
export function midtransSignature(orderId: string, statusCode: string, grossAmount: string, serverKey: string) {
  return createHash("sha512").update(orderId + statusCode + grossAmount + serverKey).digest("hex");
}

export function verifySignature(
  n: { order_id?: string; status_code?: string; gross_amount?: string; signature_key?: string },
  serverKey: string,
) {
  if (!n.order_id || !n.status_code || !n.gross_amount || !n.signature_key || !serverKey) return false;
  const expected = Buffer.from(midtransSignature(n.order_id, n.status_code, n.gross_amount, serverKey));
  const got = Buffer.from(n.signature_key);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export type OrderStatus = "paid" | "pending" | "failed" | "expired" | "cancelled" | "refunded";

/** Memetakan status Midtrans ke status pesanan internal. */
export function mapStatus(transactionStatus: string, fraudStatus?: string): OrderStatus {
  switch (transactionStatus) {
    case "capture": return fraudStatus === "challenge" ? "pending" : "paid";
    case "settlement": return "paid";
    case "pending": return "pending";
    case "deny": return "failed";
    case "cancel": return "cancelled";
    case "expire": return "expired";
    case "refund":
    case "partial_refund":
    case "chargeback": return "refunded";
    default: return "pending";
  }
}
