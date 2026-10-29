"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, ButtonLink, Notice, inputCls } from "@/components/ui";
import { AREAS } from "@/lib/goals-core/areas";
import { CUSTOM_QUESTIONS, type CustomItem } from "@/lib/goals-core/custom-interview";
import { draftCustomPlan, saveCustomTemplate } from "@/lib/goals-core/actions/custom";

export function CustomBuilder() {
  const [area, setArea] = useState<string>(AREAS[0].id);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [items, setItems] = useState<CustomItem[] | null>(null);
  const [summary, setSummary] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (saved) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-display text-xl font-bold"><span aria-hidden>★ </span>Saved to your library</p>
        <p className="mt-1 text-muted">It’s private to you. Start a goal with it any time.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/onboarding?template=${saved}`}>Start a goal with it</ButtonLink>
          <ButtonLink href="/app/library" variant="secondary">Go to my templates</ButtonLink>
        </div>
      </div>
    );
  }

  if (!items) {
    return (
      <form className="space-y-4 rounded-2xl border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await draftCustomPlan({ area, answers });
            if (!r.ok) return setError(r.error);
            setItems(r.items);
            setSummary(r.summary);
            setName(answers.goal?.slice(0, 80) ?? "");
          });
        }}>
        <label className="block"><span className="mb-1 block text-sm font-semibold">Area</span>
          <select value={area} onChange={(e) => setArea(e.target.value)} className={inputCls}>{AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
        {CUSTOM_QUESTIONS.map((q, i) => (
          <label key={q.id} className="block">
            <span className="mb-1 block text-sm font-semibold">{i + 1}. {q.prompt}{q.optional ? <span className="font-normal text-muted"> (optional)</span> : null}</span>
            {q.type === "choice" ? (
              <select value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} className={inputCls}>
                <option value="">Choose one</option>{q.options!.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input type={q.type === "number" ? "number" : "text"} min={q.type === "number" ? 1 : undefined} required={q.id === "goal"} maxLength={600}
                value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} className={inputCls} />
            )}
          </label>
        ))}
        {error && <p role="alert" className="text-sm text-coral-ink">{error}</p>}
        <Button type="submit" disabled={pending}>{pending ? "Drafting your plan..." : "Draft my plan"}</Button>
        <p className="text-xs text-muted">The AI drafts; you decide. Health and money plans include required safety steps. No medical or financial advice.</p>
      </form>
    );
  }

  const weeks = [...new Set(items.map((i) => i.week))].sort((a, b) => a - b);
  const update = (idx: number, patch: Partial<CustomItem>) => setItems((list) => list!.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-4">
      <Notice>Here’s the draft. Rename, edit or remove any step, or add your own. Required safety steps stay.</Notice>
      <label className="block"><span className="mb-1 block text-sm font-semibold">Template name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputCls} /></label>
      {summary && <p className="text-sm text-muted">{summary}</p>}
      {weeks.map((w) => (
        <fieldset key={w} className="rounded-2xl border border-line bg-surface p-3">
          <legend className="px-1 font-semibold">Week {w}</legend>
          <ul className="space-y-2">
            {items.map((it, idx) => it.week !== w ? null : (
              <li key={idx} className="flex items-end gap-2">
                <label className="min-w-0 flex-1"><span className="mb-1 block text-xs text-muted">{it.kind === "guardrail" ? "Required step" : it.kind}</span>
                  <input value={it.title} readOnly={it.kind === "guardrail"} onChange={(e) => update(idx, { title: e.target.value })} maxLength={140} className={inputCls} /></label>
                {it.kind !== "guardrail" && (
                  <button type="button" onClick={() => setItems((l) => l!.filter((_, i) => i !== idx))} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-coral-ink underline" aria-label={`Remove "${it.title}"`}>Remove</button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setItems((l) => [...l!, { week: w, title: "My own step", kind: "action" }])} className="mt-2 min-h-11 text-sm font-semibold underline">Add a step to week {w}</button>
        </fieldset>
      ))}
      {error && <p role="alert" className="text-sm text-coral-ink">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => {
          setError(null);
          start(async () => {
            const r = await saveCustomTemplate({ name, area, summary, restart: answers.restart || null, items: items.filter((i) => i.title.trim()) });
            if (r.ok) setSaved(r.templateId);
            else setError(r.error);
          });
        }}>{pending ? "Saving..." : "Save to my library"}</Button>
        <Button type="button" variant="secondary" onClick={() => setItems(null)}>Back to questions</Button>
        <Link href="/app/library" className="inline-flex min-h-11 items-center px-2 text-sm underline">Cancel</Link>
      </div>
    </div>
  );
}
