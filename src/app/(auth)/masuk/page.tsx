import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = { title: "Masuk" };

export default function MasukPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <Suspense><Inner sp={searchParams} /></Suspense>;
}

async function Inner({ sp }: { sp: Promise<{ next?: string }> }) {
  const { next } = await sp;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/akun";
  return <LoginForm next={safe} />;
}
