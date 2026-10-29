"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button, ButtonLink, Notice, inputCls } from "@/components/ui";
import { RingPicker } from "@/components/goals/ring-picker";
import { PreviewTabs } from "@/components/goals/preview-tabs";
import { MediaUpload } from "@/components/goals/media-upload";
import { CopyButton } from "@/components/goals/copy-button";
import { Question, type Answer } from "@/components/onboarding/question";
import { WeekGrid } from "@/components/onboarding/week-grid";
import { APPROACH_QUESTIONS, READINESS_QUESTIONS } from "@/lib/approach";
import { TONES } from "@/lib/tone";
import { DEFAULT_SUMMARY_VISIBILITY } from "@/lib/visibility";
import { AREAS, areaTint } from "@/lib/goals-core/areas";
import { SUMMARY_KEYS, starterFor } from "@/lib/goals-core/rules";
import { fieldsFromTemplate } from "@/lib/goals-core/template-shape";
import { completeFirstWin, createGoalFromOnboarding, getOnboardingTemplate, logOnboarding } from "@/lib/goals-core/actions/onboarding";
import type { CreateGoalResult } from "@/lib/goals-core/create";
import type { CheckIn, Goal, GoalField, SummaryVisibility, TemplateBody, Tone, TrackingMode, Visibility } from "@/lib/types";

export interface OnboardingTemplate { id: string; name: string; area: string; tier: string; summary: string; usable: boolean }

type StepId = "arena" | "goal" | "now" | "week" | "tone" | "people" | "why" | "build" | "win";
const STEP_TITLE: Record<StepId, string> = {
  arena: "Pick your arena", goal: "Say it in one sentence", now: "Where are you now", week: "Your week", tone: "Pick your tone",
  people: "Who's in your corner", why: "Why it matters", build: "Watch the plan build", win: "First win today",
};
const AREA_REACTION: Record<string, string> = {
  Health: "Strong choice. Small steps, steady body.", Wealth: "Money goals love a plan. Let's make one.", "Work and career": "Future you is already grateful.",
  Relationships: "The people goals are the best goals.", "Faith and spirit": "Room for what matters most.", "Learning and growth": "A curious mind is a growing one.",
  "Home and life": "A calmer home starts with one shelf.", "Giving and community": "The world needs more of this.",
};

export function OnboardingFlow(props: {
  userId: string;
  displayName: string | null;
  templates: OnboardingTemplate[];
  order: "tone_first" | "people_first" | string;
  allowed: Visibility[];
  maxInvites: number;
  defaultTone: Tone;
  aiAllowed: boolean;
  initialTemplate: { body: TemplateBody; usable: boolean } | null;
}) {
  const steps: StepId[] = props.order === "people_first"
    ? ["arena", "goal", "now", "week", "people", "tone", "why", "build", "win"]
    : ["arena", "goal", "now", "week", "tone", "people", "why", "build", "win"];
  const [idx, setIdx] = useState(0);
  const step = steps[idx];

  const init = props.initialTemplate?.usable ? props.initialTemplate.body : null;
  const [area, setArea] = useState<string | null>(init?.area ?? null);
  const [template, setTemplate] = useState<TemplateBody | null>(init);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [title, setTitle] = useState("");
  const [finishDate, setFinishDate] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [sharpening, setSharpening] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [approach, setApproach] = useState<Record<string, number>>({});
  const [readiness, setReadiness] = useState<Record<string, number>>({});
  const [tracking, setTracking] = useState<TrackingMode>("simple");
  const [slots, setSlots] = useState<string[]>([]);
  const [tone, setTone] = useState<Tone>(props.defaultTone);
  const [ring, setRing] = useState<Visibility>("private");
  const [summary, setSummary] = useState<Omit<SummaryVisibility, "goal_id">>(DEFAULT_SUMMARY_VISIBILITY);
  const [fieldRings, setFieldRings] = useState<Record<string, Visibility>>({});
  const [invites, setInvites] = useState<string[]>([]);
  const [inviteDraft, setInviteDraft] = useState("");
  const [why, setWhy] = useState("");
  const [whyMedia, setWhyMedia] = useState<string | null>(null);
  const [result, setResult] = useState<CreateGoalResult | null>(null);
  const [shown, setShown] = useState(0);
  const [won, setWon] = useState(false);
  const [pending, start] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const building = useRef(false);

  useEffect(() => {
    void logOnboarding("onboarding_started", { variant: props.order });
  }, [props.order]);

  // Weeks appear one by one once the plan is saved.
  const totalWeeks = result?.ok ? result.weeks.length : 0;
  useEffect(() => {
    if (!totalWeeks) return;
    const t = setInterval(() => setShown((n) => (n >= totalWeeks ? n : n + 1)), 280);
    return () => clearInterval(t);
  }, [totalWeeks]);

  const fields = useMemo(() => fieldsFromTemplate(template), [template]);
  const finalTitle = title.trim() || template?.name || `My ${area ? area.toLowerCase() : ""} goal`.replace(/\s+/g, " ");
  const starter = starterFor(area, finalTitle);

  function goTo(n: number) {
    const next = Math.max(0, Math.min(steps.length - 1, n));
    if (steps[next] === "build" && !result?.ok) build();
    if (steps[idx] === "build" && steps[next] !== "win" && result?.ok) return; // once saved, the flow only moves forward
    setIdx(next);
    void logOnboarding("onboarding_step", { step: steps[next], index: next });
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function build() {
    if (building.current) return;
    building.current = true;
    start(async () => {
      const r = await createGoalFromOnboarding({
        area, templateId: template?.id ?? null, title: finalTitle, finishDate: finishDate || null,
        // Template "calendar_slots" questions are answered by the week grid in step 4.
        answers: Object.fromEntries(
          [...Object.entries(answers), ...(template?.onboarding ?? []).filter((q) => q.type === "calendar_slots" && slots.length).map((q) => [q.id, slots] as const)]
            .filter(([, v]) => v !== "" && !(Array.isArray(v) && !v.length)),
        ),
        approachAnswers: approach, readiness, slots, trackingMode: tracking, tone, visibility: ring, summary,
        fieldVisibility: fieldRings, invites, why: why.trim() || null, whyMediaPath: whyMedia, starter,
      });
      setResult(r);
      if (!r.ok) building.current = false;
    });
  }

  async function pickTemplate(id: string | null) {
    if (!id) return setTemplate(null);
    setLoadingTpl(true);
    const t = await getOnboardingTemplate(id).catch(() => null);
    setLoadingTpl(false);
    if (t?.usable) {
      setTemplate(t.body);
      setFieldRings({});
    }
  }

  async function sharpen() {
    if (title.trim().length < 2) return;
    setSharpening(true);
    try {
      const res = await fetch("/api/ai/sharpen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sentence: title, area }) });
      const json = (await res.json()) as { options?: string[] };
      setOptions(json.options ?? []);
    } catch {
      setOptions([]);
    } finally {
      setSharpening(false);
    }
  }

  function addInvite() {
    const e = inviteDraft.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || invites.includes(e) || invites.length >= props.maxInvites) return;
    setInvites([...invites, e]);
    setInviteDraft("");
  }

  // Synthetic goal for the live preview: sample numbers, the person's real switches.
  const preview = useMemo(() => {
    const goal: Goal = {
      id: "preview", owner_id: props.userId, title: finalTitle, why: why || null, why_media_url: null, area, template_id: null,
      start_date: new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10), finish_date: finishDate || null,
      tracking_mode: tracking, tone, approach: null, answers: {}, readiness: {}, if_then: [], restart_rule: null, status: "active",
      visibility: ring, circle_id: null, parent_goal_id: null, share_token: null, finished_at: null, created_at: "",
    };
    const gf: GoalField[] = fields.map((f, i) => ({ id: `f${i}`, goal_id: "preview", key: f.key, label: f.label, kind: f.kind, unit: f.unit, target: f.target, visibility: fieldRings[f.key] ?? f.visibility, sort: i }));
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    const sample = (n: number) => Object.fromEntries(gf.filter((f) => f.kind !== "note" && f.kind !== "photo").map((f) => [f.key, n]));
    const checkIns: CheckIn[] = [
      { id: "c1", goal_id: "preview", user_id: props.userId, day: day(1), status: "done", rating: null, note: "Felt good today", photo_url: null, values: sample(3), created_at: "" },
      { id: "c2", goal_id: "preview", user_id: props.userId, day: day(2), status: "partly", rating: null, note: "Short version", photo_url: null, values: sample(1), created_at: "" },
    ];
    return { goal, fields: gf, checkIns };
  }, [props.userId, finalTitle, why, area, finishDate, tracking, tone, ring, fields, fieldRings]);

  const pct = Math.round(((idx + 1) / steps.length) * 100);
  const canSkip = step !== "build" && step !== "win";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs font-semibold text-muted"><span>Step {idx + 1} of {steps.length}</span><span>About 3 minutes</span></div>
        <div role="progressbar" aria-label="Setup progress" aria-valuenow={idx + 1} aria-valuemin={1} aria-valuemax={steps.length} className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-bold outline-none">{STEP_TITLE[step]}</h1>

      <div className="mt-4 space-y-4">
        {step === "arena" && (
          <>
            <p className="text-muted">Which part of life is this goal about? Tap one.</p>
            <div className="grid grid-cols-2 gap-3">
              {AREAS.map((a) => {
                const on = area === a.id;
                return (
                  <button key={a.id} type="button" aria-pressed={on} onClick={() => { setArea(a.id); if (template && template.area !== a.id) setTemplate(null); }}
                    className={`min-h-24 rounded-2xl border-2 p-3 text-left transition hover:-translate-y-0.5 ${on ? "shadow-md" : ""}`}
                    style={{ ...areaTint(a.accent, on ? 30 : 14), borderColor: on ? a.accent : undefined }}>
                    <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: a.accent }}>{a.icon}</span>
                    <span className="mt-2 block font-fun text-base font-black">{a.label}</span>
                    <span className="block text-xs text-muted">{a.blurb}</span>
                    {on && <span className="mt-1 block text-xs font-semibold">✓ Picked</span>}
                  </button>
                );
              })}
            </div>
            <p aria-live="polite" className="min-h-6 font-fun font-bold text-sage-ink">{area ? AREA_REACTION[area] : ""}</p>
            {area && (
              <section aria-labelledby="tpls" className="rounded-2xl border border-line bg-surface p-4">
                <h2 id="tpls" className="font-semibold">Start from a template? (optional)</h2>
                <ul className="mt-2 space-y-2">
                  <li>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                      <input type="radio" name="tpl" className="h-5 w-5" checked={!template} onChange={() => pickTemplate(null)} />
                      <span>No template, I’ll describe it myself</span>
                    </label>
                  </li>
                  {template && !props.templates.some((t) => t.id === template.id) && (
                    <li>
                      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                        <input type="radio" name="tpl" className="mt-0.5 h-5 w-5" checked readOnly />
                        <span><span className="font-semibold">{template.name}</span> <span className="text-xs text-muted">{template.tier}</span><span className="block text-sm text-muted">{template.summary}</span></span>
                      </label>
                    </li>
                  )}
                  {props.templates.filter((t) => t.area === area).map((t) => (
                    <li key={t.id}>
                      {t.usable ? (
                        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                          <input type="radio" name="tpl" className="mt-0.5 h-5 w-5" checked={template?.id === t.id} onChange={() => pickTemplate(t.id)} />
                          <span><span className="font-semibold">{t.name}</span> <span className="text-xs text-muted">{t.tier}</span><span className="block text-sm text-muted">{t.summary}</span></span>
                        </label>
                      ) : (
                        <p className="flex min-h-11 items-start gap-3 px-2 py-2 text-sm">
                          <span aria-hidden>🔒</span>
                          <span><span className="font-semibold">{t.name}</span> <span className="text-xs text-muted">{t.tier}</span> · <Link href={`/marketplace/${t.id}`} className="underline">See details</Link></span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <p aria-live="polite" className="mt-1 text-xs text-muted">{loadingTpl ? "Loading template..." : template ? `Using ${template.name}.` : ""}</p>
              </section>
            )}
          </>
        )}

        {step === "goal" && (
          <>
            <label className="block">
              <span className="mb-1 block font-semibold">Your goal, in one sentence</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} className={`${inputCls} text-lg`} placeholder={template ? template.name : "Run my first half marathon in April"} />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={sharpen} disabled={sharpening || title.trim().length < 2}>{sharpening ? "Thinking..." : "✦ Make it sharper"}</Button>
              <span className="text-xs text-muted">Suggestions only. Keep yours if you like it.</span>
            </div>
            {options.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Pick one, or keep your own</legend>
                {options.map((o) => (
                  <label key={o} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${title === o ? "border-sage bg-sage/10" : "border-line bg-surface"}`}>
                    <input type="radio" name="sharp" className="h-5 w-5" checked={title === o} onChange={() => setTitle(o)} />
                    <span>{o}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <label className="block max-w-xs">
              <span className="mb-1 block font-semibold">Finish by <span className="font-normal text-muted">(optional)</span></span>
              <input type="date" value={finishDate} onChange={(e) => setFinishDate(e.target.value)} className={inputCls} />
            </label>
          </>
        )}

        {step === "now" && (
          <>
            {template?.onboarding.filter((q) => q.type !== "calendar_slots").map((q) => (
              <Question key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
            ))}
            {!template && (
              <label className="block rounded-2xl border border-line bg-surface p-4">
                <span className="mb-2 block font-semibold">Where are you starting from? <span className="font-normal text-muted">(optional)</span></span>
                <input type="text" maxLength={500} value={typeof answers.now === "string" ? answers.now : ""} onChange={(e) => setAnswers((a) => ({ ...a, now: e.target.value }))} className={inputCls} placeholder="e.g. I walk twice a week" />
              </label>
            )}
            <fieldset className="rounded-2xl border border-line bg-surface p-4">
              <legend className="px-1 font-semibold">How do you want to track it?</legend>
              <div className="mt-1 grid gap-2 sm:grid-cols-3">
                {([["simple", "Simple", "Done, partly or missed"], ["detailed", "Detailed", "Numbers like miles or dollars"], ["reflective", "Reflective", "A short note, no numbers"]] as const).map(([v, l, d]) => (
                  <label key={v} className={`flex min-h-11 cursor-pointer flex-col rounded-xl border p-3 ${tracking === v ? "border-sage bg-sage/10" : "border-line"}`}>
                    <span className="flex items-center gap-2 font-semibold"><input type="radio" name="tracking" className="h-5 w-5" checked={tracking === v} onChange={() => setTracking(v)} />{l}</span>
                    <span className="text-xs text-muted">{d}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <details className="rounded-2xl border border-line bg-surface p-4" open>
              <summary className="min-h-11 cursor-pointer font-semibold">How you get things done (5 quick taps)</summary>
              <div className="mt-2 space-y-4">
                {APPROACH_QUESTIONS.map((q) => (
                  <fieldset key={q.id}>
                    <legend className="mb-1 text-sm font-semibold">{q.prompt}</legend>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((o, i) => {
                        const on = approach[q.id] === i;
                        return (
                          <label key={o.label} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3 text-sm has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)] ${on ? "border-navy bg-navy font-semibold text-[#F7F3EC] dark:border-gold dark:bg-gold dark:text-navy" : "border-line"}`}>
                            <input type="radio" className="sr-only" name={`ap-${q.id}`} checked={on} onChange={() => setApproach((a) => ({ ...a, [q.id]: i }))} />{o.label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </details>
            <details className="rounded-2xl border border-line bg-surface p-4">
              <summary className="min-h-11 cursor-pointer font-semibold">How ready are you? (keeps week one realistic)</summary>
              <div className="mt-2 space-y-4">
                {READINESS_QUESTIONS.map((q) => {
                  const v = readiness[q.id] ?? 3;
                  return (
                    <label key={q.id} className="block">
                      <span className="block text-sm font-semibold">{q.prompt}</span>
                      <input type="range" min={1} max={5} value={v} onChange={(e) => setReadiness((r) => ({ ...r, [q.id]: Number(e.target.value) }))} className="h-11 w-full accent-[var(--sage)]" aria-valuetext={`${v} of 5`} />
                      <span className="flex justify-between text-xs text-muted"><span>{q.low}</span><span>{v} of 5</span><span>{q.high}</span></span>
                    </label>
                  );
                })}
              </div>
            </details>
          </>
        )}

        {step === "week" && (
          <>
            <p className="text-muted">Tap the times you could give this goal. The plan only uses the time you give it.</p>
            <div className="rounded-2xl border border-line bg-surface p-3"><WeekGrid label="Open slots this week" value={slots} onChange={setSlots} /></div>
            <p aria-live="polite" className="min-h-6 font-fun font-bold text-sage-ink">
              {slots.length === 0 ? "" : slots.length <= 3 ? "Small and steady. That's how it sticks." : slots.length <= 8 ? "That's a solid rhythm." : "Big week! We'll keep a rest day in there."}
            </p>
          </>
        )}

        {step === "tone" && (
          <>
            <p className="text-muted">How should your reminders sound? Hear each one first.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {TONES.map((t) => {
                const on = tone === t.id;
                return (
                  <button key={t.id} type="button" aria-pressed={on} onClick={() => setTone(t.id)}
                    className={`min-h-11 rounded-2xl border-2 p-4 text-left transition ${on ? "border-gold bg-gold/15" : "border-line bg-surface hover:bg-surface-2"}`}>
                    <span className="font-fun text-lg font-black">{t.name}{on ? " ✓" : ""}</span>
                    <span className="block text-sm text-muted">{t.blurb}</span>
                    <span className="mt-2 block rounded-xl bg-surface-2 p-3 text-sm italic">“{t.sample}”</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === "people" && (
          <>
            <p className="text-muted">Everything starts private. Widen it only if you want to; the preview shows exactly what each group sees.</p>
            <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
              <RingPicker legend="Who can see this goal at all" value={ring} onChange={setRing} allowed={props.allowed} />
              {SUMMARY_KEYS.slice(0, 4).map((k) => (
                <RingPicker key={k.key} legend={k.label} hint={k.hint} value={summary[k.key]} allowed={props.allowed} onChange={(v) => setSummary((s) => ({ ...s, [k.key]: v }))} />
              ))}
              <details>
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">More switches: why, notes, photos{fields.length ? ", tracked numbers" : ""}</summary>
                <div className="space-y-4 pt-2">
                  {SUMMARY_KEYS.slice(4).map((k) => (
                    <RingPicker key={k.key} legend={k.label} hint={k.hint} value={summary[k.key]} allowed={props.allowed} onChange={(v) => setSummary((s) => ({ ...s, [k.key]: v }))} />
                  ))}
                  {fields.map((f) => (
                    <RingPicker key={f.key} legend={f.label} hint={f.visibility === "private" ? "Starts private" : undefined} value={fieldRings[f.key] ?? f.visibility} allowed={props.allowed}
                      onChange={(v) => setFieldRings((s) => ({ ...s, [f.key]: v }))} />
                  ))}
                </div>
              </details>
              {!props.allowed.includes("circle") && <p className="text-xs text-muted">Free includes Only me and one chosen person. <Link href="/pricing" className="underline">See Pro</Link> for circles and public links.</p>}
            </div>
            <PreviewTabs goal={preview.goal} fields={preview.fields} summary={summary} checkIns={preview.checkIns} planItems={[]} note="example numbers" />
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="font-semibold">Invite someone into your corner <span className="font-normal text-muted">(optional)</span></p>
              <p className="text-xs text-muted">They get a link and see the Chosen people preview above once they accept. {props.maxInvites === 1 ? "Free includes one person." : ""}</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1"><span className="sr-only">Their email</span>
                  <input type="email" value={inviteDraft} onChange={(e) => setInviteDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }} className={inputCls} placeholder="friend@example.com" disabled={invites.length >= props.maxInvites} /></label>
                <Button type="button" variant="secondary" onClick={addInvite} disabled={invites.length >= props.maxInvites}>Add</Button>
              </div>
              {invites.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {invites.map((e) => (
                    <li key={e} className="flex items-center justify-between gap-2"><span>{e}</span>
                      <button type="button" className="min-h-11 px-2 text-coral-ink underline" onClick={() => setInvites(invites.filter((x) => x !== e))} aria-label={`Remove ${e}`}>Remove</button></li>
                  ))}
                </ul>
              )}
              {invites.length > 0 && ring === "private" && <p className="mt-2 text-xs text-coral-ink">Your goal is set to Only me, so they’ll see nothing until you widen it to Chosen people.</p>}
            </div>
          </>
        )}

        {step === "why" && (
          <>
            <p className="text-muted">On hard days we’ll show you this. Only you see it unless you choose otherwise.</p>
            <label className="block">
              <span className="mb-1 block font-semibold">Why does this matter to you?</span>
              <textarea value={why} onChange={(e) => setWhy(e.target.value)} maxLength={1000} className={`${inputCls} min-h-28`} placeholder="So I can keep up with my kids at the park." />
            </label>
            <MediaUpload userId={props.userId} folder="why" accept="image/*,audio/*" label="Add a photo or voice memo (optional)" onUploaded={(p) => setWhyMedia(p)} />
            <p className="text-xs text-muted">{props.aiAllowed ? "Next, the AI drafts your plan from your answers." : "Next, we build a starter plan from your answers. AI redrafts are part of Pro."} You can edit every step.</p>
          </>
        )}

        {step === "build" && (
          <div aria-live="polite" aria-busy={pending}>
            {pending && (
              <div className="rounded-2xl border border-line bg-surface p-6 text-center">
                <p className="font-fun text-xl font-black">Building your plan...</p>
                <p className="mt-1 text-sm text-muted">Fitting it to your week, your pace and how you get things done.</p>
                <div className="mx-auto mt-4 h-2 w-40 overflow-hidden rounded-full bg-surface-2"><div className="h-full w-1/2 animate-pulse rounded-full bg-gold" /></div>
              </div>
            )}
            {result && !result.ok && (
              <div className="space-y-3">
                <Notice tone="warn">{result.error}</Notice>
                <div className="flex flex-wrap gap-2">
                  {result.upgrade ? <ButtonLink href="/pricing">See Pro</ButtonLink> : <Button type="button" onClick={build}>Try again</Button>}
                  <ButtonLink href="/app/goals" variant="secondary">My goals</ButtonLink>
                </div>
              </div>
            )}
            {result?.ok && (
              <div className="space-y-3">
                <p className="text-muted">{result.summary} {result.usedAi ? "Drafted by AI from your answers." : "Built from your template and answers."} Everything stays editable.</p>
                <ol className="space-y-2">
                  {result.weeks.slice(0, shown).map((w) => (
                    <li key={w.week} className="rounded-2xl border border-line bg-surface p-3 motion-safe:animate-[gk-pop_300ms_ease-out]">
                      <p className="font-semibold">Week {w.week}</p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-muted">{w.titles.slice(0, 4).map((t, i) => <li key={i}>{t}</li>)}{w.titles.length > 4 && <li>and {w.titles.length - 4} more</li>}</ul>
                    </li>
                  ))}
                </ol>
                {shown < result.weeks.length && <p className="text-sm text-muted">Laying out week {shown + 1} of {result.weeks.length}...</p>}
                <style>{`@keyframes gk-pop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
              </div>
            )}
          </div>
        )}

        {step === "win" && result?.ok && (
          <div className="space-y-4">
            {!won ? (
              <>
                <p className="text-muted">One tiny thing, right now, so today ends with a check mark.</p>
                <div className="rounded-2xl border border-line bg-surface p-5 text-center">
                  <p className="font-fun text-xl font-black">{starter}</p>
                  <button type="button" disabled={pending}
                    onClick={() => start(async () => { const r = await completeFirstWin(result.goalId, result.starterItemId); if (r.ok) setWon(true); })}
                    className="mx-auto mt-5 flex h-24 w-24 items-center justify-center rounded-full bg-sage text-4xl text-white shadow-md transition hover:scale-105 disabled:opacity-60"
                    aria-label="I did it: check in for today">
                    <span aria-hidden>✓</span>
                  </button>
                  <p className="mt-2 text-sm text-muted">Tap when it’s done</p>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border-2 p-6 text-center" style={{ borderColor: "var(--gold)" }} role="status">
                <p className="font-display text-3xl font-bold">Day one: done.</p>
                <p className="mt-2 text-muted">{props.displayName ? `${props.displayName}, that` : "That"} check mark is the start of your streak. See you tomorrow.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <ButtonLink href="/app">Go to Today</ButtonLink>
                  <ButtonLink href={`/app/goals/${result.goalId}`} variant="secondary">See my full plan</ButtonLink>
                </div>
              </div>
            )}
            {result.invites.length > 0 && (
              <div className="rounded-2xl border border-line bg-surface p-4">
                <p className="font-semibold">Send your invite link{result.invites.length > 1 ? "s" : ""}</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {result.invites.map((i) => (
                    <li key={i.url}><span className="font-semibold">{i.email}</span>
                      <div className="mt-1 flex flex-wrap items-center gap-2"><code className="break-all rounded bg-surface-2 px-2 py-1 text-xs">{i.url}</code><CopyButton text={i.url} /></div></li>
                  ))}
                </ul>
              </div>
            )}
            {!won && <Link href="/app" className="inline-flex min-h-11 items-center text-sm underline">Skip for now</Link>}
          </div>
        )}
      </div>

      <nav aria-label="Setup steps" className="sticky bottom-0 mt-6 flex items-center justify-between gap-2 border-t border-line bg-bg/95 py-3 backdrop-blur">
        <Button type="button" variant="ghost" onClick={() => goTo(idx - 1)} disabled={idx === 0 || step === "win" || (step === "build" && (pending || !!result?.ok))}>← Back</Button>
        <div className="flex gap-2">
          {canSkip && step !== "why" && <Button type="button" variant="ghost" onClick={() => goTo(idx + 1)}>Skip</Button>}
          {step === "why" && <Button type="button" onClick={() => goTo(idx + 1)}>{why || whyMedia ? "Build my plan" : "Skip and build my plan"}</Button>}
          {step !== "why" && step !== "build" && step !== "win" && <Button type="button" onClick={() => goTo(idx + 1)}>Next →</Button>}
          {step === "build" && result?.ok && shown >= result.weeks.length && <Button type="button" onClick={() => goTo(idx + 1)}>Next: first win →</Button>}
        </div>
      </nav>
    </div>
  );
}
