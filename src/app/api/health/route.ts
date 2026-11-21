import { NextResponse } from "next/server";
import { anonClient } from "@/lib/supabase/anon";

export async function GET() {
  const { data, error } = await anonClient().rpc("pub_data_status");
  return NextResponse.json({ ok: !error, data_status: data ?? null }, { status: error ? 503 : 200, headers: { "cache-control": "no-store" } });
}
