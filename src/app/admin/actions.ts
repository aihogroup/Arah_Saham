"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const TAGS = ["market", "blog", "announcements"] as const;

export async function revalidateContent(tag: (typeof TAGS)[number]) {
  await requireAdmin();
  if (!TAGS.includes(tag)) return { ok: false };
  revalidateTag(tag, "max");
  return { ok: true };
}

/** Beri langganan manual. Dicatat otomatis di audit_log lewat trigger. */
export async function grantPremium(userId: string, days: number) {
  await requireAdmin();
  const p = z.object({ userId: z.string().uuid(), days: z.number().int().min(1).max(3650) }).safeParse({ userId, days });
  if (!p.success) return { ok: false, error: "Input tidak valid" };
  const now = new Date();
  const { error } = await adminClient().from("subscriptions").insert({
    user_id: p.data.userId, plan_id: null, source: "manual", starts_at: now.toISOString(), ends_at: new Date(now.getTime() + p.data.days * 86_400_000).toISOString(),
  });
  return error ? { ok: false, error: "Gagal memberi langganan" } : { ok: true };
}

export async function setRole(userId: string, role: "admin" | "user") {
  const me = await requireAdmin();
  const p = z.object({ userId: z.string().uuid(), role: z.enum(["admin", "user"]) }).safeParse({ userId, role });
  if (!p.success) return { ok: false, error: "Input tidak valid" };
  if (p.data.userId === me.userId && role !== "admin") return { ok: false, error: "Tidak bisa mencabut admin dari diri sendiri" };
  const a = adminClient();
  if (role === "admin") await a.from("user_roles").upsert({ user_id: p.data.userId, role: "admin" });
  else await a.from("user_roles").delete().eq("user_id", p.data.userId).eq("role", "admin");
  return { ok: true };
}

export async function setActive(userId: string, active: boolean) {
  await requireAdmin();
  const p = z.string().uuid().safeParse(userId);
  if (!p.success) return { ok: false };
  const { error } = await adminClient().from("profiles").update({ is_active: active }).eq("id", p.data);
  return { ok: !error };
}

export async function resolveQuarantine(id: number) {
  await requireAdmin();
  const sb = await createClient();
  const { error } = await sb.from("quarantine").update({ resolved: true }).eq("id", id);
  return { ok: !error };
}
