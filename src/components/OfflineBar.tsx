"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

// Status jaringan dari peramban. Saat luring, halaman yang sudah termuat tetap bisa dibaca;
// pengguna diberi tahu bahwa data baru belum bisa diambil.
const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb); window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
};

export default function OfflineBar() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div className="offline-bar" role="status" aria-live="polite">
      <span className="inline-flex items-center gap-2"><WifiOff size={16} aria-hidden="true" />Anda sedang luring. Data yang tampil mungkin belum terbaru; halaman akan diperbarui saat koneksi kembali.</span>
    </div>
  );
}
