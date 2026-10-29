// Template validation for the creator editor and the admin review queue.
// Mirrors templates/schema.json, then adds the marketplace rules from
// docs/MARKETPLACE.md §4: no medical/financial/guaranteed-result claims, health
// goals carry a doctor step, and health and money numbers default to Private.
import * as z from "zod/v4";
import type { TemplateBody } from "@/lib/types";

export const AREAS = [
  "Health", "Wealth", "Work and career", "Relationships", "Faith and spirit", "Learning and growth", "Home and life", "Giving and community",
] as const;
export const TIERS = ["Free", "Premium", "Creator", "Custom"] as const;
export const QUESTION_TYPES = ["text", "number", "slider", "choice", "multi_choice", "date", "calendar_slots"] as const;
export const FIELD_KINDS = ["number", "yes_no", "rating", "note", "money", "duration", "percent"] as const;
export const VISIBILITIES = ["private", "chosen", "circle", "public"] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const slug = z.string().regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes");
const key = z.string().regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores").max(40);

export const templateBodySchema = z.object({
  id: slug.max(80),
  name: text(80),
  area: z.enum(AREAS),
  tier: z.enum(TIERS),
  price: z.number().min(0).max(500).nullable().optional(),
  summary: text(500),
  duration: z.string().trim().max(40).optional(),
  onboarding: z
    .array(
      z.object({
        id: key,
        prompt: text(200),
        type: z.enum(QUESTION_TYPES),
        options: z.array(text(120)).max(12).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        reaction: z.string().trim().max(200).optional(),
        optional: z.boolean().optional(),
      }).refine((q) => !["choice", "multi_choice"].includes(q.type) || (q.options?.length ?? 0) >= 2, {
        message: "Choice questions need at least two options", path: ["options"],
      }),
    )
    .min(1, "Add at least one onboarding question")
    .max(20),
  plan_blueprint: z.object({
    phases: z
      .array(
        z.object({
          name: text(80),
          weeks: z.string().trim().regex(/^\d+(\s*-\s*\d+)?$/, 'Weeks look like "1-4" or "5"'),
          benchmarks: z.array(text(200)).max(10).optional(),
          actions: z.array(text(200)).max(10).optional(),
        }),
      )
      .min(1, "Add at least one phase")
      .max(12),
    calendar: z.string().trim().max(300).optional(),
  }),
  approach_variants: z
    .object({
      habit: z.string().max(300), willpower: z.string().max(300), time: z.string().max(300), reward: z.string().max(300), resource: z.string().max(300),
    })
    .partial()
    .optional(),
  tracked_fields: z
    .array(
      z.object({
        id: key,
        label: text(80),
        kind: z.enum(FIELD_KINDS),
        unit: z.string().trim().max(20).optional(),
        default_visibility: z.enum(VISIBILITIES),
      }),
    )
    .max(12),
  guardrails: z.array(text(300)).max(10),
  restart_rules: z.string().trim().max(600).optional(),
  addon_tracks: z.array(text(120)).max(10).optional(),
  creator: z.object({ id: z.string().optional(), revenue_share: z.number().min(0).max(1).optional(), license: z.string().optional() }).optional(),
  price_log: z.array(z.object({ from: z.unknown(), to: z.unknown(), basis: z.string(), date: z.string() })).optional(),
});

// Claims a template may never make. Matched case-insensitively on word boundaries.
const CLAIM_PATTERNS: { re: RegExp; why: string }[] = [
  { re: /\bguarantee(d|s)?\b/i, why: "Guaranteed results" },
  { re: /\bcures?\b|\bcured\b|\bheals? (your|any)\b/i, why: "Medical cure claim" },
  { re: /\blose \d+(\.\d+)?\s*(lbs?|pounds?|kg|kilos?)\s+(in|by|within)\b/i, why: "Specific weight-loss promise" },
  { re: /\bget rich\b|\bmillionaire\b|\bdouble your (money|income)\b/i, why: "Get-rich promise" },
  { re: /\b(earn|make) \$?\d[\d,]*(k)?\s*(a|per|every)\s*(day|week|month)\b/i, why: "Income promise" },
  { re: /\brisk[- ]free\b|\bno risk\b/i, why: "Risk-free claim" },
  { re: /\b100% (results|success)\b|\bresults in \d+ days\b/i, why: "Result promise" },
  { re: /\b(reverses?|treats?) (diabetes|depression|anxiety|cancer|disease)\b/i, why: "Treatment claim" },
  { re: /\b(diagnos(e|is)|prescri(be|ption)|dosage)\b/i, why: "Medical advice" },
  { re: /\b(stock|crypto) picks?\b|\bguaranteed returns?\b/i, why: "Investment advice" },
];

// "Results are not guaranteed" is fine; only flag claims that are not negated.
const NEGATION = /\b(no|not|never|without|cannot|can't|isn't|aren't|won't|doesn't|don't)\b[^.!?]{0,24}$/i;

export interface ClaimHit {
  phrase: string;
  why: string;
  where: string;
}

export function scanClaims(textValue: string, where = "text"): ClaimHit[] {
  const hits: ClaimHit[] = [];
  for (const { re, why } of CLAIM_PATTERNS) {
    const g = new RegExp(re.source, "gi");
    for (const m of textValue.matchAll(g)) {
      const before = textValue.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
      if (NEGATION.test(before)) continue;
      hits.push({ phrase: m[0], why, where });
    }
  }
  return hits;
}

/** Every human-readable string in a template, with where it came from. */
export function templateStrings(t: Partial<TemplateBody>): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const add = (where: string, s: string | undefined | null) => s && out.push({ where, text: s });
  add("Name", t.name);
  add("Summary", t.summary);
  t.onboarding?.forEach((q, i) => {
    add(`Question ${i + 1}`, q.prompt);
    add(`Question ${i + 1} reaction`, q.reaction);
    q.options?.forEach((o) => add(`Question ${i + 1} option`, o));
  });
  t.plan_blueprint?.phases?.forEach((p, i) => {
    add(`Phase ${i + 1} name`, p.name);
    p.actions?.forEach((a) => add(`Phase ${i + 1} action`, a));
    p.benchmarks?.forEach((b) => add(`Phase ${i + 1} benchmark`, b));
  });
  add("Calendar", t.plan_blueprint?.calendar);
  Object.entries(t.approach_variants ?? {}).forEach(([k, v]) => add(`Approach: ${k}`, v));
  t.tracked_fields?.forEach((f) => add("Tracked field", f.label));
  t.guardrails?.forEach((g) => add("Guardrail", g));
  add("Restart rules", t.restart_rules);
  t.addon_tracks?.forEach((a) => add("Add-on track", a));
  return out;
}

export function scanTemplateClaims(t: Partial<TemplateBody>): ClaimHit[] {
  return templateStrings(t).flatMap((s) => scanClaims(s.text, s.where));
}

const HEALTHY_WORDS = /\b(diet|supplements?|weight|fasting|calories|medication|alcohol|sober)\b/i;
const DOCTOR = /\b(doctor|clinician|physician|medical professional|health ?care provider)\b/i;
const SENSITIVE_LABEL =
  /\b(weight|bmi|body fat|waist|blood|glucose|sugar|pressure|heart rate|cholesterol|calories?|medications?|symptoms?|mood|sleep|drinks?|alcohol|period|income|salary|debt|savings|balance|net worth|spend(ing)?|budget|money|dollars?|paid|pay)\b/i;

/** Health goals (or any diet/weight/supplement template) need the doctor step. */
export function needsDoctorStep(t: Pick<TemplateBody, "area" | "name" | "summary">): boolean {
  return t.area === "Health" || HEALTHY_WORDS.test(`${t.name} ${t.summary}`);
}
export function hasDoctorStep(t: Pick<TemplateBody, "guardrails">): boolean {
  return (t.guardrails ?? []).some((g) => DOCTOR.test(g));
}

/** Health and money numbers must start Private. */
export function mustBePrivate(area: string, f: { label: string; kind: string }): boolean {
  return area === "Wealth" || f.kind === "money" || SENSITIVE_LABEL.test(f.label);
}

export interface TemplateCheck {
  ok: boolean;
  body: TemplateBody | null;
  errors: string[]; // blocking problems
  claims: ClaimHit[]; // blocking too, listed separately so the editor can point at them
}

/** Full check used before save, submit and approval. */
export function validateTemplate(input: unknown): TemplateCheck {
  const parsed = templateBodySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false, body: null, claims: [],
      errors: parsed.error.issues.map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`),
    };
  }
  const body = parsed.data as TemplateBody;
  const errors: string[] = [];
  if (needsDoctorStep(body) && !hasDoctorStep(body)) errors.push('Health, diet, weight and supplement templates need a "talk to your doctor" guardrail.');
  for (const f of body.tracked_fields) {
    if (mustBePrivate(body.area, f) && f.default_visibility !== "private") errors.push(`"${f.label}" is a health or money number, so it must default to Private.`);
  }
  const ids = new Set<string>();
  for (const q of body.onboarding) {
    if (ids.has(q.id)) errors.push(`Two questions share the id "${q.id}".`);
    ids.add(q.id);
  }
  const fids = new Set<string>();
  for (const f of body.tracked_fields) {
    if (fids.has(f.id)) errors.push(`Two tracked fields share the id "${f.id}".`);
    fids.add(f.id);
  }
  const claims = scanTemplateClaims(body);
  return { ok: errors.length === 0 && claims.length === 0, body, errors, claims };
}

/** "Morning run length" -> "morning_run_length" (for question and field ids). */
export function toKey(s: string, fallback: string): string {
  const k = s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32);
  return k || fallback;
}

/** URL-safe template id from a name plus a short random suffix. */
export function toTemplateId(name: string, suffix: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "template";
  return `${base}-${suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)}`;
}
