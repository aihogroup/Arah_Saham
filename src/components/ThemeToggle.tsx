"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { getTheme, saveTheme, subscribePrefs, type Theme } from "@/lib/prefs";

/** Pengalih mode warna: terang atau gelap (tanpa mode sistem). */
export default function ThemeToggle() {
  const mode = useSyncExternalStore(subscribePrefs, getTheme, () => "light" as Theme);
  const to: Theme = mode === "dark" ? "light" : "dark";
  const Icon = mode === "dark" ? Moon : Sun;
  const label = mode === "dark" ? "Mode gelap aktif. Ganti ke terang" : "Mode terang aktif. Ganti ke gelap";
  return (
    <button type="button" className="btn btn-ghost px-3" onClick={() => saveTheme(to)} aria-label={label} title={label}>
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
