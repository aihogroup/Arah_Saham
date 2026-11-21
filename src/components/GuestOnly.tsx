"use client";

import type { ReactNode } from "react";
import { useSignedIn } from "@/components/useSignedIn";

/** Menampilkan isi hanya untuk pengunjung yang belum login (halaman publik tetap statis/cached). */
export default function GuestOnly({ children }: { children: ReactNode }) {
  return useSignedIn() === false ? <>{children}</> : null;
}
