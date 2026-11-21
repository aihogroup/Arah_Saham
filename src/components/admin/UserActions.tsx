"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { grantPremium, setActive, setRole } from "@/app/admin/actions";

export default function UserActions({ id, isAdmin, active }: { id: string; isAdmin: boolean; active: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    const r = await fn();
    setMsg(r.ok ? null : r.error ?? `${label} gagal`);
    if (r.ok) router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <button className="underline" onClick={() => run("Beri", () => grantPremium(id, 30), "Beri Premium 30 hari?")}>+30 hari</button>
      <button className="underline" onClick={() => run("Peran", () => setRole(id, isAdmin ? "user" : "admin"), isAdmin ? "Cabut admin?" : "Jadikan admin?")}>{isAdmin ? "Cabut admin" : "Jadikan admin"}</button>
      <button className="underline" onClick={() => run("Status", () => setActive(id, !active), active ? "Nonaktifkan akun?" : undefined)}>{active ? "Nonaktifkan" : "Aktifkan"}</button>
      {msg && <span role="alert" className="down">{msg}</span>}
    </div>
  );
}
