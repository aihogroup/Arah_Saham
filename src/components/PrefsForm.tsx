"use client";

import { useSyncExternalStore } from "react";
import { T, useT } from "@/components/T";
import { Delta } from "@/components/ui";
import type { Key } from "@/lib/i18n";
import { DEFAULTS, getPrefs, getTheme, resetPrefs, savePrefs, saveTheme, subscribePrefs, type Accent, type FontSize, type Lang, type Theme } from "@/lib/prefs";

const SWATCH: Record<Accent, string> = { cobalt: "#2554d6", emerald: "#047857", violet: "#6d28d9", orange: "#c2410c", rose: "#be123c" };

function Group<V extends string>({ label, hint, value, options, onChange }: {
  label: Key; hint?: Key; value: V; options: { v: V; k: Key; swatch?: string }[]; onChange: (v: V) => void;
}) {
  const t = useT();
  return (
    <fieldset className="space-y-2">
      <legend className="text-[15px] font-semibold"><T k={label} /></legend>
      {hint && <p className="text-[13px] text-muted"><T k={hint} /></p>}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t(label)}>
        {options.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
            className="btn">
            {o.swatch && <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full border border-line" style={{ background: o.swatch }} />}
            <T k={o.k} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Switch({ label, hint, on, onChange }: { label: Key; hint: Key; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-[15px] font-semibold"><T k={label} /></p><p className="text-[13px] text-muted"><T k={hint} /></p></div>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full border transition-colors ${on ? "border-brand bg-brand" : "border-line bg-surface"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all ${on ? "left-[26px]" : "left-0.5"}`} />
        <span className="sr-only"><T k={label} /></span>
      </button>
    </div>
  );
}

export default function PrefsForm() {
  const p = useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULTS);
  const theme = useSyncExternalStore(subscribePrefs, getTheme, () => "system" as Theme);

  return (
    <div className="space-y-6">
      <section className="card space-y-6" aria-labelledby="h-tampilan">
        <h2 id="h-tampilan" className="text-lg"><T k="set.title" /></h2>
        <Group<Lang> label="set.language" hint="set.language.hint" value={p.lang} onChange={(v) => savePrefs({ lang: v })}
          options={[{ v: "id", k: "set.lang.id" }, { v: "en", k: "set.lang.en" }]} />
        <Group<Theme> label="set.theme" value={theme} onChange={saveTheme}
          options={[{ v: "system", k: "set.theme.system" }, { v: "light", k: "set.theme.light" }, { v: "dark", k: "set.theme.dark" }]} />
        <Group<Accent> label="set.accent" value={p.accent} onChange={(v) => savePrefs({ accent: v })}
          options={(["cobalt", "emerald", "violet", "orange", "rose"] as Accent[]).map((a) => ({ v: a, k: `set.accent.${a}` as Key, swatch: SWATCH[a] }))} />
        <Group<FontSize> label="set.fontSize" value={p.fs} onChange={(v) => savePrefs({ fs: v })}
          options={[{ v: "s", k: "set.fs.s" }, { v: "m", k: "set.fs.m" }, { v: "l", k: "set.fs.l" }, { v: "xl", k: "set.fs.xl" }]} />
        <Group<"comfortable" | "compact"> label="set.density" value={p.density} onChange={(v) => savePrefs({ density: v })}
          options={[{ v: "comfortable", k: "set.density.comfortable" }, { v: "compact", k: "set.density.compact" }]} />
      </section>

      <section className="card space-y-5" aria-labelledby="h-akses">
        <h2 id="h-akses" className="text-lg"><T k="set.access" /></h2>
        <Switch label="set.cb" hint="set.cb.hint" on={p.cb} onChange={(v) => savePrefs({ cb: v })} />
        <Switch label="set.contrast" hint="set.contrast.hint" on={p.contrast} onChange={(v) => savePrefs({ contrast: v })} />
        <Switch label="set.motion" hint="set.motion.hint" on={p.motion === "reduce"} onChange={(v) => savePrefs({ motion: v ? "reduce" : "auto" })} />
      </section>

      <section className="card" aria-labelledby="h-pratinjau">
        <h2 id="h-pratinjau" className="text-lg"><T k="set.preview" /></h2>
        <p className="mt-2 text-muted"><T k="set.previewText" /></p>
        <div className="mt-3 flex flex-wrap items-center gap-4"><span className="text-[28px] font-semibold">7.412,35</span><Delta value={1.24} /><Delta value={-0.87} /><button type="button" className="btn btn-primary">ArahSaham.com</button></div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted" role="status"><T k="set.saved" /></p>
        <button type="button" className="btn" onClick={resetPrefs}><T k="set.reset" /></button>
      </div>
    </div>
  );
}
