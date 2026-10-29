"use client";
import { useState } from "react";
import { cx } from "@/components/ui";

// Landing-page demo of the four rings: pick who is looking, switch each number
// on or off, and the preview shows exactly what that ring would see.

const RINGS = [
  { id: 0, label: "Private", who: "Only you" },
  { id: 1, label: "Chosen", who: "The people you chose" },
  { id: 2, label: "Circle", who: "Your run club circle" },
  { id: 3, label: "Public", who: "Anyone with the link" },
] as const;

const FIELDS = [
  { key: "pct", label: "Progress to goal", value: "71%" },
  { key: "miles", label: "Miles this week", value: "28.4 mi" },
  { key: "hours", label: "Training hours", value: "5 h 40 m" },
  { key: "weight", label: "Weight change", value: "−9.2 lb" },
  { key: "notes", label: "Journal notes", value: "3 entries" },
];

export function VisibilityDemo() {
  const [ring, setRing] = useState(0);
  const [on, setOn] = useState<Record<string, boolean>>({ pct: true, miles: true, hours: false, weight: false, notes: false });
  const shown = ring === 0 ? [] : FIELDS.filter((f) => on[f.key]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Who can see this goal: City Marathon</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 sm:grid-cols-4">
          {RINGS.map((r) => (
            <button key={r.id} type="button" aria-pressed={ring === r.id} onClick={() => setRing(r.id)}
              className={cx("min-h-11 rounded-lg px-2 text-sm font-semibold", ring === r.id ? "bg-surface text-ink shadow-sm" : "text-muted")}>
              {ring === r.id && <span aria-hidden>● </span>}{r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <ul className="mt-4 divide-y divide-line">
        {FIELDS.map((f) => (
          <li key={f.key} className="flex items-center gap-3 py-2">
            <span className="flex-1 text-sm">{f.label}</span>
            <span className="text-sm text-muted">{f.value}</span>
            <button type="button" role="switch" aria-checked={!!on[f.key]} aria-label={`Share ${f.label.toLowerCase()}`}
              onClick={() => setOn((s) => ({ ...s, [f.key]: !s[f.key] }))}
              className="inline-flex min-h-11 min-w-16 items-center justify-center">
              <span className={cx("relative inline-flex h-6 w-11 items-center rounded-full border border-line transition", on[f.key] ? "bg-sage" : "bg-surface-2")}>
                <span className={cx("absolute h-5 w-5 rounded-full bg-surface shadow transition", on[f.key] ? "left-[22px]" : "left-0.5")} />
              </span>
              <span className="sr-only">{on[f.key] ? "On" : "Off"}</span>
              <span aria-hidden className="ml-1 w-6 text-xs text-muted">{on[f.key] ? "On" : "Off"}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-xl border border-dashed border-line bg-surface-2 p-3" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Preview for: {RINGS[ring].who}</p>
        {ring === 0 ? (
          <p className="mt-1 text-sm"><b>Only you</b> can see this goal. Every new goal starts here.</p>
        ) : (
          <div className="mt-1 text-sm">
            <p className="font-semibold">City Marathon</p>
            {shown.length ? (
              <ul className="mt-1 list-disc pl-5">{shown.map((f) => <li key={f.key}>{f.label}: {f.value}</li>)}</ul>
            ) : (
              <p className="text-muted">The goal name only.</p>
            )}
            {FIELDS.length - shown.length > 0 && <p className="mt-1 text-xs text-muted">{FIELDS.length - shown.length} more stay private.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
