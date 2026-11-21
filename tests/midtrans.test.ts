import { describe, expect, it } from "vitest";
import { mapStatus, midtransSignature, verifySignature } from "@/lib/midtrans";

describe("midtrans signature", () => {
  const key = "SB-Mid-server-test";
  const sig = midtransSignature("AS-1", "200", "79000.00", key);
  it("menerima tanda tangan sah", () => {
    expect(verifySignature({ order_id: "AS-1", status_code: "200", gross_amount: "79000.00", signature_key: sig }, key)).toBe(true);
  });
  it("menolak nominal yang diubah", () => {
    expect(verifySignature({ order_id: "AS-1", status_code: "200", gross_amount: "1.00", signature_key: sig }, key)).toBe(false);
  });
  it("menolak kunci server kosong atau field hilang", () => {
    expect(verifySignature({ order_id: "AS-1", status_code: "200", gross_amount: "79000.00", signature_key: sig }, "")).toBe(false);
    expect(verifySignature({ order_id: "AS-1" }, key)).toBe(false);
  });
});

describe("mapStatus", () => {
  it.each([
    ["settlement", undefined, "paid"], ["capture", "accept", "paid"], ["capture", "challenge", "pending"],
    ["pending", undefined, "pending"], ["deny", undefined, "failed"], ["cancel", undefined, "cancelled"],
    ["expire", undefined, "expired"], ["refund", undefined, "refunded"], ["aneh", undefined, "pending"],
  ])("%s/%s -> %s", (t, f, want) => expect(mapStatus(t, f)).toBe(want));
});
