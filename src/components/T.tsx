"use client";

import { useSyncExternalStore } from "react";
import { tr, type Key } from "@/lib/i18n";
import { DEFAULTS, getPrefs, subscribePrefs, type Lang } from "@/lib/prefs";

export function useLang(): Lang {
  return useSyncExternalStore(subscribePrefs, () => getPrefs().lang, () => DEFAULTS.lang);
}

/** Teks antarmuka terjemahan. Render server memakai bahasa Indonesia; bahasa pilihan diterapkan setelah hidrasi. */
export function T({ k }: { k: Key }) {
  return <>{tr(useLang(), k)}</>;
}

/** Untuk atribut (aria-label, placeholder) yang tidak bisa memuat komponen. */
export function useT() {
  const lang = useLang();
  return (k: Key) => tr(lang, k);
}
