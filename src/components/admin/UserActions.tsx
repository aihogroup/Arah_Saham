"use client";

import { confirmDialog } from "@/components/ConfirmDialog";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { grantPremium, setActive, setRole } from "@/app/admin/actions";

export default function UserActions({ id, isAdmin, active }: { id: string; isAdmin: boolean; active: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>, confirmText?: string, danger = false) {
    if (confirmText && !(await confirmDialog({ title: confirmText, confirmLabel: label, tone: danger ? "danger" : "default" }))) return;
    if (busy) return;
    setBusy(true);
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? null : r.error ?? `${label} gagal`);
    if (r.ok) router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-meta">
      <button className="btn btn-sm" disabled={busy} onClick={() => run("Beri Premium", () => grantPremium(id, 30), "Beri Premium 30 hari?")}>+30 hari</button>
      <button className="btn btn-sm" disabled={busy} onClick={() => run(isAdmin ? "Cabut admin" : "Jadikan admin", () => setRole(id, isAdmin ? "user" : "admin"), isAdmin ? "Cabut hak admin pengguna ini?" : "Jadikan pengguna ini admin?", isAdmin)}>{isAdmin ? "Cabut admin" : "Jadikan admin"}</button>
      <button className={`btn btn-sm ${active ? "btn-danger" : ""}`} disabled={busy} onClick={() => run(active ? "Nonaktifkan" : "Aktifkan", () => setActive(id, !active), active ? "Nonaktifkan akun ini? Pengguna tidak bisa masuk sampai diaktifkan lagi." : undefined, true)}>{active ? "Nonaktifkan" : "Aktifkan"}</button>
      {msg && <span role="alert" className="down">{msg}</span>}
    </div>
  );
}
