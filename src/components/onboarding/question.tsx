"use client";
import { useId } from "react";
import { inputCls } from "@/components/ui";
import { WeekGrid } from "@/components/onboarding/week-grid";
import type { TemplateQuestion } from "@/lib/types";

export type Answer = string | number | boolean | string[];

const chip = (on: boolean) =>
  `inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)] ${on ? "border-navy bg-navy text-[#F7F3EC] dark:border-gold dark:bg-gold dark:text-navy" : "border-line bg-surface hover:bg-surface-2"}`;

/** One template onboarding question, rendered by type; the reaction line appears once it's answered. */
export function Question({ q, value, onChange }: { q: TemplateQuestion; value: Answer | undefined; onChange: (v: Answer) => void }) {
  const id = useId();
  const answered = value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
  const prompt = <>{q.prompt}{q.optional && <span className="font-normal text-muted"> (optional)</span>}</>;
  let control: React.ReactNode;
  switch (q.type) {
    case "number":
      control = <input id={id} type="number" inputMode="decimal" min={q.min} max={q.max} value={typeof value === "number" ? value : ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} />;
      break;
    case "slider": {
      const min = q.min ?? 0, max = q.max ?? 10;
      const v = typeof value === "number" ? value : Math.round((min + max) / 2);
      control = (
        <div className="flex items-center gap-3">
          <input id={id} type="range" min={min} max={max} value={v} onChange={(e) => onChange(Number(e.target.value))} className="h-11 flex-1 accent-[var(--sage)]" aria-valuetext={String(v)} />
          <output htmlFor={id} className="w-12 text-right font-display text-xl font-bold">{v}</output>
        </div>
      );
      break;
    }
    case "choice":
      control = (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`${id}-l`}>
          {(q.options ?? []).map((o) => (
            <label key={o} className={chip(value === o)}>
              <input type="radio" className="sr-only" name={id} checked={value === o} onChange={() => onChange(o)} />{o}
            </label>
          ))}
        </div>
      );
      break;
    case "multi_choice": {
      const arr = Array.isArray(value) ? value : [];
      control = (
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-l`}>
          {(q.options ?? []).map((o) => (
            <label key={o} className={chip(arr.includes(o))}>
              <input type="checkbox" className="sr-only" checked={arr.includes(o)} onChange={() => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])} />{o}
            </label>
          ))}
        </div>
      );
      break;
    }
    case "date":
      control = <input id={id} type="date" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
      break;
    case "calendar_slots":
      control = <WeekGrid label={q.prompt} value={Array.isArray(value) ? value : []} onChange={onChange} />;
      break;
    default:
      control = <input id={id} type="text" maxLength={500} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
  }
  const grouped = q.type === "choice" || q.type === "multi_choice" || q.type === "calendar_slots";
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      {grouped
        ? <p id={`${id}-l`} className="mb-2 font-semibold">{prompt}</p>
        : <label htmlFor={id} className="mb-2 block font-semibold">{prompt}</label>}
      {control}
      <p aria-live="polite" className="mt-2 min-h-5 font-fun text-sm font-bold text-sage-ink">{answered ? q.reaction ?? "Got it." : ""}</p>
    </div>
  );
}
