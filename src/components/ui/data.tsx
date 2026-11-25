// Molekul penyajian data dan pilihan: kartu angka, kartu pilihan, langkah wizard, kolom isian berlabel.
import type { ReactNode } from "react";
import { Check } from "lucide-react";

/** Kartu angka. `accent` menandai satu angka terpenting di halaman (Efek Von Restorff); pakai seperlunya. */
export function StatCard({ label, value, note, accent, valueClass = "" }: { label: ReactNode; value: ReactNode; note?: ReactNode; accent?: boolean; valueClass?: string }) {
  return (
    <div className={`card ${accent ? "card-accent" : ""}`}>
      <p className="text-meta text-muted">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${valueClass || "text-2xl"}`}>{value}</p>
      {note && <p className="mt-1 text-meta text-muted">{note}</p>}
    </div>
  );
}

/** Kartu pilihan tunggal (role="radio"). Bungkus beberapa kartu dalam elemen role="radiogroup". */
export function ChoiceCard({ checked, onSelect, title, body, disabled }: { checked: boolean; onSelect: () => void; title: ReactNode; body?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={checked} disabled={disabled} onClick={onSelect}
      className={`flex min-h-[var(--tap-min)] items-start gap-3 rounded-xl border p-3 text-start transition-colors duration-150 disabled:opacity-60 ${checked ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
      <span aria-hidden="true" className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${checked ? "border-brand bg-brand text-brand-fg" : "border-line-strong"}`}>
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        {body && <span className="mt-1 block text-meta text-muted">{body}</span>}
      </span>
    </button>
  );
}

/** Langkah wizard: berapa yang sudah selesai dan berapa yang tersisa (Efek Zeigarnik, Hukum Miller: ≤ 7 langkah). */
export function Steps({ steps, current, label = "Langkah" }: { steps: readonly string[]; current: number; label?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-meta text-muted">Langkah {current + 1} dari {steps.length}</p>
      <ol className="steps" aria-label={label}>
        {steps.map((s, i) => (
          <li key={s} aria-current={i === current ? "step" : undefined} data-state={i < current ? "done" : undefined}>
            {i < current ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : <span aria-hidden="true">{i + 1}.</span>}
            {s}{i < current && <span className="sr-only"> (selesai)</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Kolom isian berlabel dengan petunjuk dan pesan galat sebaris (terhubung via aria-describedby). */
export function Field({ id, label, hint, error, children }: { id: string; label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-meta text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-meta down" role="alert">{error}</p>}
    </div>
  );
}

/** Atribut ARIA untuk input di dalam <Field>: panggil dengan id dan galat yang sama. */
export const fieldAria = (id: string, error?: string | null, hint?: boolean) => ({
  id,
  "aria-invalid": error ? (true as const) : undefined,
  "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
});
