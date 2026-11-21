"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { getTheme, saveTheme, subscribePrefs, type Theme } from "@/lib/prefs";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "Tema: ikuti sistem", light: "Tema: terang", dark: "Tema: gelap" };

export default function ThemeToggle() {
  const mode = useSyncExternalStore(subscribePrefs, getTheme, () => "system" as Theme);
  const next = () => saveTheme(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]);
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  return (
    <button type="button" className="btn btn-ghost px-3" onClick={next} aria-label={`${LABEL[mode]}. Klik untuk mengganti.`} title={LABEL[mode]}>
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
