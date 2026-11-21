// Preferensi tampilan pengguna (disimpan di perangkat/localStorage; tidak dikirim ke server).
// Diterapkan sebagai atribut data-* pada <html> sehingga cukup CSS untuk mengubah tampilan, tanpa render ulang halaman.

export type Lang = "id" | "en";
export type FontSize = "s" | "m" | "l" | "xl";
export type Accent = "cobalt" | "emerald" | "violet" | "orange" | "rose";
export type Theme = "system" | "light" | "dark";
export type Prefs = {
  lang: Lang; fs: FontSize; accent: Accent;
  cb: boolean;                      // palet naik/turun ramah buta warna (biru/oranye)
  contrast: boolean;                // kontras tinggi
  motion: "auto" | "reduce";        // kurangi animasi
  density: "comfortable" | "compact";
};

export const DEFAULTS: Prefs = { lang: "id", fs: "m", accent: "cobalt", cb: false, contrast: false, motion: "auto", density: "comfortable" };
const KEY = "prefs", THEME_KEY = "theme", EVENT = "prefs-change";

const FS: FontSize[] = ["s", "m", "l", "xl"], ACCENTS: Accent[] = ["cobalt", "emerald", "violet", "orange", "rose"];

/** Skrip sebaris untuk <head>: menerapkan preferensi sebelum cat pertama (hindari kedipan). Harus setara dengan applyPrefs. */
export const BOOT_SCRIPT = `try{var d=document.documentElement,p=JSON.parse(localStorage.getItem("prefs")||"{}"),t=localStorage.getItem("theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);if(p.fs==="s"||p.fs==="l"||p.fs==="xl")d.setAttribute("data-fs",p.fs);if(p.accent&&p.accent!=="cobalt")d.setAttribute("data-accent",p.accent);if(p.cb)d.setAttribute("data-cb","1");if(p.contrast)d.setAttribute("data-contrast","1");if(p.motion==="reduce")d.setAttribute("data-motion","reduce");if(p.density==="compact")d.setAttribute("data-density","compact");if(p.lang==="en")d.lang="en"}catch(e){}`;

function sanitize(raw: unknown): Prefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Prefs>;
  return {
    lang: r.lang === "en" ? "en" : "id",
    fs: FS.includes(r.fs as FontSize) ? (r.fs as FontSize) : "m",
    accent: ACCENTS.includes(r.accent as Accent) ? (r.accent as Accent) : "cobalt",
    cb: r.cb === true, contrast: r.contrast === true,
    motion: r.motion === "reduce" ? "reduce" : "auto",
    density: r.density === "compact" ? "compact" : "comfortable",
  };
}

let cacheRaw: string | null = null, cacheVal: Prefs = DEFAULTS;

/** Snapshot stabil (objek sama selama isi penyimpanan tidak berubah) untuk useSyncExternalStore. */
export function getPrefs(): Prefs {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* penyimpanan diblokir */ }
  if (raw === cacheRaw) return cacheVal;
  cacheRaw = raw;
  try { cacheVal = raw ? sanitize(JSON.parse(raw)) : DEFAULTS; } catch { cacheVal = DEFAULTS; }
  return cacheVal;
}

export function getTheme(): Theme {
  try { const t = localStorage.getItem(THEME_KEY); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; }
}

export function subscribePrefs(cb: () => void) {
  window.addEventListener(EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

function setAttr(el: HTMLElement, name: string, on: boolean, value = "1") { if (on) el.setAttribute(name, value); else el.removeAttribute(name); }

export function applyPrefs(p: Prefs, theme: Theme = getTheme()) {
  const el = document.documentElement;
  setAttr(el, "data-theme", theme !== "system", theme);
  setAttr(el, "data-fs", p.fs !== "m", p.fs);
  setAttr(el, "data-accent", p.accent !== "cobalt", p.accent);
  setAttr(el, "data-cb", p.cb); setAttr(el, "data-contrast", p.contrast);
  setAttr(el, "data-motion", p.motion === "reduce", "reduce");
  setAttr(el, "data-density", p.density === "compact", "compact");
  el.lang = p.lang;
}

export function savePrefs(patch: Partial<Prefs>) {
  const next = sanitize({ ...getPrefs(), ...patch });
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* abaikan */ }
  applyPrefs(next);
  window.dispatchEvent(new Event(EVENT));
}

export function saveTheme(t: Theme) {
  try { if (t === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t); } catch { /* abaikan */ }
  applyPrefs(getPrefs(), t);
  window.dispatchEvent(new Event(EVENT));
}

export function resetPrefs() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(THEME_KEY); } catch { /* abaikan */ }
  applyPrefs(DEFAULTS, "system");
  window.dispatchEvent(new Event(EVENT));
}
