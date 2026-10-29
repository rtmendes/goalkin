"use client";
import { useId } from "react";
import { RING_LABEL, RINGS } from "@/lib/visibility";
import type { Visibility } from "@/lib/types";

const ICON: Record<Visibility, string> = { private: "🔒", chosen: "☺", circle: "◍", public: "◎" };

/** Four-way switch for one value. Rings the plan doesn't include are shown but disabled, with a word saying why. */
export function RingPicker({
  legend, hint, value, onChange, allowed,
}: {
  legend: string;
  hint?: string;
  value: Visibility;
  onChange: (v: Visibility) => void;
  allowed: Visibility[];
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold">{legend}</legend>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4">
        {RINGS.map((r) => {
          const ok = allowed.includes(r);
          const on = value === r;
          return (
            <label key={r}
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-xl border px-2 text-center text-xs font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)] ${on ? "border-navy bg-navy text-[#F7F3EC] dark:border-gold dark:bg-gold dark:text-navy" : "border-line bg-surface"} ${ok ? "" : "cursor-not-allowed opacity-60"}`}>
              <input type="radio" className="sr-only" name={name} value={r} checked={on} disabled={!ok} onChange={() => onChange(r)} />
              <span aria-hidden>{ICON[r]}</span>
              <span>{RING_LABEL[r]}{!ok && <span className="block text-[10px] font-normal">Pro</span>}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
