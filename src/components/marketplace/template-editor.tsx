"use client";
import { useActionState, useMemo, useState } from "react";
import { Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { saveTemplate, type SaveState } from "@/app/creators/actions";
import {
  AREAS, FIELD_KINDS, QUESTION_TYPES, VISIBILITIES, mustBePrivate, toKey, validateTemplate,
} from "@/lib/marketplace/template-schema";
import type { Approach, FieldKind, TemplateBody, TemplateQuestion, Visibility } from "@/lib/types";

// Structured editor for creator templates. It keeps a friendly form state and
// builds a TemplateBody from it; the same validator runs here (live) and on the server.

interface Q { prompt: string; type: TemplateQuestion["type"]; options: string; reaction: string; optional: boolean; min: string; max: string }
interface P { name: string; weeks: string; actions: string; benchmarks: string }
interface F { label: string; kind: FieldKind; unit: string; visibility: Visibility }
interface State {
  name: string; area: string; price: string; summary: string; duration: string; calendar: string;
  questions: Q[]; phases: P[]; fields: F[];
  guardrails: string; restart: string; addons: string;
  approach: Record<Approach, string>;
}

const APPROACH_LABELS: [Approach, string][] = [
  ["habit", "Habit builder"], ["willpower", "Willpower and challenge"], ["time", "Time manager"], ["reward", "Reward driven"], ["resource", "Resource planner"],
];
const TYPE_LABEL: Record<string, string> = { text: "Short answer", number: "Number", slider: "Slider", choice: "Pick one", multi_choice: "Pick any", date: "Date", calendar_slots: "Calendar times" };
const KIND_LABEL: Record<string, string> = { number: "Number", yes_no: "Yes / no", rating: "Rating 1-5", note: "Note", money: "Money", duration: "Time spent", percent: "Percent" };
const VIS_LABEL: Record<Visibility, string> = { private: "Only me (Private)", chosen: "Chosen people", circle: "Circle", public: "Public" };

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const emptyQ = (): Q => ({ prompt: "", type: "text", options: "", reaction: "", optional: false, min: "", max: "" });
const emptyP = (): P => ({ name: "", weeks: "", actions: "", benchmarks: "" });
const emptyF = (): F => ({ label: "", kind: "number", unit: "", visibility: "private" });

function fromBody(b: TemplateBody | null): State {
  return {
    name: b?.name ?? "", area: b?.area ?? "Health", price: b?.price != null ? String(b.price) : "0", summary: b?.summary ?? "",
    duration: b?.duration ?? "", calendar: b?.plan_blueprint.calendar ?? "",
    questions: b?.onboarding.map((q) => ({
      prompt: q.prompt, type: q.type, options: (q.options ?? []).join("\n"), reaction: q.reaction ?? "", optional: !!q.optional,
      min: q.min != null ? String(q.min) : "", max: q.max != null ? String(q.max) : "",
    })) ?? [emptyQ()],
    phases: b?.plan_blueprint.phases.map((p) => ({ name: p.name, weeks: p.weeks, actions: (p.actions ?? []).join("\n"), benchmarks: (p.benchmarks ?? []).join("\n") })) ?? [emptyP()],
    fields: b?.tracked_fields.map((f) => ({ label: f.label, kind: f.kind, unit: f.unit ?? "", visibility: f.default_visibility })) ?? [],
    guardrails: (b?.guardrails ?? []).join("\n"), restart: b?.restart_rules ?? "", addons: (b?.addon_tracks ?? []).join("\n"),
    approach: { habit: "", willpower: "", time: "", reward: "", resource: "", ...(b?.approach_variants ?? {}) },
  };
}

function uniqueKeys(labels: string[], prefix: string): string[] {
  const seen = new Map<string, number>();
  return labels.map((l, i) => {
    const k = toKey(l, `${prefix}${i + 1}`);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n > 1 ? `${k}_${n}` : k;
  });
}

function toBody(s: State, id: string): TemplateBody {
  const qIds = uniqueKeys(s.questions.map((q) => q.prompt), "q");
  const fIds = uniqueKeys(s.fields.map((f) => f.label), "f");
  const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v));
  const variants = Object.fromEntries(Object.entries(s.approach).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
  return {
    id, name: s.name.trim(), area: s.area, tier: "Creator", price: num(s.price) ?? 0, summary: s.summary.trim(),
    ...(s.duration.trim() ? { duration: s.duration.trim() } : {}),
    onboarding: s.questions.map((q, i) => ({
      id: qIds[i], prompt: q.prompt.trim(), type: q.type,
      ...(["choice", "multi_choice"].includes(q.type) ? { options: lines(q.options) } : {}),
      ...(q.type === "slider" || q.type === "number" ? { min: num(q.min), max: num(q.max) } : {}),
      ...(q.reaction.trim() ? { reaction: q.reaction.trim() } : {}),
      ...(q.optional ? { optional: true } : {}),
    })),
    plan_blueprint: {
      phases: s.phases.map((p) => ({ name: p.name.trim(), weeks: p.weeks.trim(), actions: lines(p.actions), benchmarks: lines(p.benchmarks) })),
      ...(s.calendar.trim() ? { calendar: s.calendar.trim() } : {}),
    },
    ...(Object.keys(variants).length ? { approach_variants: variants } : {}),
    tracked_fields: s.fields.map((f, i) => ({
      id: fIds[i], label: f.label.trim(), kind: f.kind, ...(f.unit.trim() ? { unit: f.unit.trim() } : {}),
      default_visibility: mustBePrivate(s.area, f) ? "private" : f.visibility,
    })),
    guardrails: lines(s.guardrails),
    ...(s.restart.trim() ? { restart_rules: s.restart.trim() } : {}),
    ...(lines(s.addons).length ? { addon_tracks: lines(s.addons) } : {}),
  };
}

function RowActions({ onUp, onDown, onRemove, label, first, last }: { onUp: () => void; onDown: () => void; onRemove: () => void; label: string; first: boolean; last: boolean }) {
  return (
    <div className="flex gap-1">
      <Button type="button" variant="ghost" onClick={onUp} disabled={first} aria-label={`Move ${label} up`}>↑</Button>
      <Button type="button" variant="ghost" onClick={onDown} disabled={last} aria-label={`Move ${label} down`}>↓</Button>
      <Button type="button" variant="ghost" onClick={onRemove} aria-label={`Remove ${label}`}>Remove</Button>
    </div>
  );
}

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function TemplateEditor({ id, initial, readOnly = false }: { id: string | null; initial: TemplateBody | null; readOnly?: boolean }) {
  const [s, setS] = useState<State>(() => fromBody(initial));
  const [state, action, pending] = useActionState<SaveState, FormData>(saveTemplate, {});
  const body = useMemo(() => toBody(s, id ?? "new-template"), [s, id]);
  const check = useMemo(() => validateTemplate(body), [body]);
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));
  const setQ = (i: number, patch: Partial<Q>) => set("questions", s.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const setP = (i: number, patch: Partial<P>) => set("phases", s.phases.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const setF = (i: number, patch: Partial<F>) => set("fields", s.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const issues = [...check.errors, ...check.claims.map((c) => `${c.where}: "${c.phrase}" reads as a claim (${c.why.toLowerCase()}). Rephrase it.`)];

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="body" value={JSON.stringify(body)} />
      {id && <input type="hidden" name="id" value={id} />}
      <fieldset disabled={readOnly} className="space-y-5">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Basics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Template name" id="t-name"><Input id="t-name" value={s.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required /></Field>
            <Field label="Life area" id="t-area">
              <Select id="t-area" value={s.area} onChange={(e) => set("area", e.target.value)}>{AREAS.map((a) => <option key={a}>{a}</option>)}</Select>
            </Field>
            <Field label="Price in US dollars" id="t-price" hint="0 to 500. You receive 70% of each sale; GoalKin keeps 30%.">
              <Input id="t-price" type="number" min={0} max={500} step="0.01" inputMode="decimal" value={s.price} onChange={(e) => set("price", e.target.value)} />
            </Field>
            <Field label="Length" id="t-duration" hint='For example "12 weeks" or "30 days".'>
              <Input id="t-duration" value={s.duration} onChange={(e) => set("duration", e.target.value)} maxLength={40} />
            </Field>
          </div>
          <div className="mt-4"><Field label="Summary" id="t-summary" hint="One or two sentences on what the plan does. No promises of results.">
            <Textarea id="t-summary" value={s.summary} onChange={(e) => set("summary", e.target.value)} maxLength={500} />
          </Field></div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Onboarding questions</h2>
          <p className="mb-3 text-sm text-muted">What people answer so the plan fits them. Three to six works best.</p>
          <ol className="space-y-4">
            {s.questions.map((q, i) => (
              <li key={i} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">Question {i + 1}</span>
                  <RowActions label={`question ${i + 1}`} first={i === 0} last={i === s.questions.length - 1}
                    onUp={() => set("questions", move(s.questions, i, -1))} onDown={() => set("questions", move(s.questions, i, 1))}
                    onRemove={() => set("questions", s.questions.filter((_, j) => j !== i))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <Field label="Question" id={`q${i}-prompt`}><Input id={`q${i}-prompt`} value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} maxLength={200} /></Field>
                  <Field label="Answer type" id={`q${i}-type`}>
                    <Select id={`q${i}-type`} value={q.type} onChange={(e) => setQ(i, { type: e.target.value as Q["type"] })}>
                      {QUESTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                    </Select>
                  </Field>
                </div>
                {(q.type === "choice" || q.type === "multi_choice") && (
                  <div className="mt-3"><Field label="Options, one per line" id={`q${i}-opts`}><Textarea id={`q${i}-opts`} value={q.options} onChange={(e) => setQ(i, { options: e.target.value })} /></Field></div>
                )}
                {(q.type === "slider" || q.type === "number") && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Lowest" id={`q${i}-min`}><Input id={`q${i}-min`} type="number" value={q.min} onChange={(e) => setQ(i, { min: e.target.value })} /></Field>
                    <Field label="Highest" id={`q${i}-max`}><Input id={`q${i}-max`} type="number" value={q.max} onChange={(e) => setQ(i, { max: e.target.value })} /></Field>
                  </div>
                )}
                <div className="mt-3"><Field label="Playful reply after they answer (optional)" id={`q${i}-react`}><Input id={`q${i}-react`} value={q.reaction} onChange={(e) => setQ(i, { reaction: e.target.value })} maxLength={200} /></Field></div>
                <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" className="h-5 w-5" checked={q.optional} onChange={(e) => setQ(i, { optional: e.target.checked })} /> People can skip this question
                </label>
              </li>
            ))}
          </ol>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => set("questions", [...s.questions, emptyQ()])}>+ Add question</Button>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Plan phases</h2>
          <p className="mb-3 text-sm text-muted">Each phase has a week range, the actions people repeat, and checkpoints at the end. Phases stretch to each person&apos;s dates.</p>
          <ol className="space-y-4">
            {s.phases.map((p, i) => (
              <li key={i} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">Phase {i + 1}</span>
                  <RowActions label={`phase ${i + 1}`} first={i === 0} last={i === s.phases.length - 1}
                    onUp={() => set("phases", move(s.phases, i, -1))} onDown={() => set("phases", move(s.phases, i, 1))}
                    onRemove={() => set("phases", s.phases.filter((_, j) => j !== i))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <Field label="Phase name" id={`p${i}-name`}><Input id={`p${i}-name`} value={p.name} onChange={(e) => setP(i, { name: e.target.value })} maxLength={80} /></Field>
                  <Field label="Weeks" id={`p${i}-weeks`} hint='Like "1-4"'><Input id={`p${i}-weeks`} value={p.weeks} onChange={(e) => setP(i, { weeks: e.target.value })} maxLength={9} /></Field>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Actions, one per line" id={`p${i}-act`}><Textarea id={`p${i}-act`} value={p.actions} onChange={(e) => setP(i, { actions: e.target.value })} /></Field>
                  <Field label="Checkpoints (benchmarks), one per line" id={`p${i}-bm`}><Textarea id={`p${i}-bm`} value={p.benchmarks} onChange={(e) => setP(i, { benchmarks: e.target.value })} /></Field>
                </div>
              </li>
            ))}
          </ol>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => set("phases", [...s.phases, emptyP()])}>+ Add phase</Button>
          <div className="mt-4"><Field label="Calendar pattern (optional)" id="t-cal" hint='For example "One daily event at the chosen time; a catch-up block on Sundays."'>
            <Input id="t-cal" value={s.calendar} onChange={(e) => set("calendar", e.target.value)} maxLength={300} />
          </Field></div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Tracked numbers</h2>
          <p className="mb-3 text-sm text-muted">What people log at check-in, and the ring you suggest for each. Health and money numbers always start Private.</p>
          <ol className="space-y-4">
            {s.fields.map((f, i) => {
              const locked = mustBePrivate(s.area, f);
              return (
                <li key={i} className="rounded-xl border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">Number {i + 1}</span>
                    <RowActions label={`tracked number ${i + 1}`} first={i === 0} last={i === s.fields.length - 1}
                      onUp={() => set("fields", move(s.fields, i, -1))} onDown={() => set("fields", move(s.fields, i, 1))}
                      onRemove={() => set("fields", s.fields.filter((_, j) => j !== i))} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Field label="Label" id={`f${i}-label`}><Input id={`f${i}-label`} value={f.label} onChange={(e) => setF(i, { label: e.target.value })} maxLength={80} /></Field>
                    <Field label="Kind" id={`f${i}-kind`}>
                      <Select id={`f${i}-kind`} value={f.kind} onChange={(e) => setF(i, { kind: e.target.value as FieldKind })}>{FIELD_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</Select>
                    </Field>
                    <Field label="Unit (optional)" id={`f${i}-unit`}><Input id={`f${i}-unit`} value={f.unit} onChange={(e) => setF(i, { unit: e.target.value })} maxLength={20} /></Field>
                    <Field label="Suggested ring" id={`f${i}-vis`} hint={locked ? "Health or money number: Private only." : undefined}>
                      <Select id={`f${i}-vis`} value={locked ? "private" : f.visibility} disabled={locked} onChange={(e) => setF(i, { visibility: e.target.value as Visibility })}>
                        {VISIBILITIES.map((v) => <option key={v} value={v}>{VIS_LABEL[v]}</option>)}
                      </Select>
                    </Field>
                  </div>
                </li>
              );
            })}
          </ol>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => set("fields", [...s.fields, emptyF()])}>+ Add tracked number</Button>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Safety and restarts</h2>
          <div className="mt-3 space-y-4">
            <Field label="Guardrails, one per line" id="t-guard" hint='Required steps people cannot delete. Health, diet and supplement plans must include a "talk to your doctor" step.'>
              <Textarea id="t-guard" value={s.guardrails} onChange={(e) => set("guardrails", e.target.value)} />
            </Field>
            {s.area === "Health" && !/doctor|clinician/i.test(s.guardrails) && (
              <Button type="button" variant="secondary" onClick={() => set("guardrails", [s.guardrails.trim(), "Talk to your doctor before starting. This plan is education, not medical advice."].filter(Boolean).join("\n"))}>
                + Add the doctor step
              </Button>
            )}
            <Field label="Restart rules" id="t-restart" hint="What happens after missed days. Be kind; missing a day never erases progress.">
              <Textarea id="t-restart" value={s.restart} onChange={(e) => set("restart", e.target.value)} maxLength={600} />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Approach variants (optional)</h2>
          <p className="mb-3 text-sm text-muted">How the plan changes for each way people work.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {APPROACH_LABELS.map(([k, label]) => (
              <Field key={k} label={label} id={`a-${k}`}>
                <Input id={`a-${k}`} value={s.approach[k]} onChange={(e) => set("approach", { ...s.approach, [k]: e.target.value })} maxLength={300} />
              </Field>
            ))}
          </div>
          <div className="mt-4"><Field label="Suggested add-ons (optional), one per line" id="t-addons" hint="Shown to buyers as optional suggestions.">
            <Textarea id="t-addons" value={s.addons} onChange={(e) => set("addons", e.target.value)} />
          </Field></div>
        </Card>
      </fieldset>

      <section aria-labelledby="checks" className={cx("rounded-2xl border p-4", issues.length ? "border-coral/50 bg-coral/10" : "border-sage/50 bg-sage/10")}>
        <h2 id="checks" className="font-semibold">{issues.length ? <><span aria-hidden>! </span>{issues.length} thing{issues.length === 1 ? "" : "s"} to fix before review</> : <><span aria-hidden>✓ </span>Ready to submit for review</>}</h2>
        {issues.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{issues.map((e) => <li key={e}>{e}</li>)}</ul>}
        <p className="mt-2 text-xs text-muted">You can save a draft any time. Submitting for review needs every item above fixed.</p>
      </section>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save draft"}</Button>
          <div aria-live="polite" className="text-sm">
            {state.error && <p role="alert" className="text-coral-ink"><span aria-hidden>! </span>{state.error}</p>}
            {state.errors?.length && !state.saved ? <ul className="list-disc pl-5 text-coral-ink">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
            {state.saved && <p role="status" className="text-sage-ink"><span aria-hidden>✓ </span>Draft saved.</p>}
          </div>
        </div>
      )}
    </form>
  );
}
