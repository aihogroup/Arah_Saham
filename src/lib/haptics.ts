// Umpan balik getar (haptik) untuk perangkat yang mendukungnya (umumnya Android).
// Peningkatan progresif: diabaikan diam-diam bila tidak didukung, dan dimatikan
// bila pengguna memilih "Kurangi animasi" (sistem operasi maupun pengaturan aplikasi).
type Kind = "tap" | "success" | "warning" | "error";
const PATTERN: Record<Kind, number | number[]> = { tap: 8, success: [10, 40, 10], warning: [20, 60, 20], error: [30, 50, 30, 50, 30] };

export function haptic(kind: Kind = "tap") {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  const reduce = document.documentElement.dataset.motion === "reduce" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  try { navigator.vibrate(PATTERN[kind]); } catch { /* diabaikan */ }
}
