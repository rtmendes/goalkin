// Automatic part of the marketplace review checklist (docs/MARKETPLACE.md §4).
// Pure: runs the validator and the plan builder for three sample people.
import { buildPlan, type DraftItem } from "@/lib/plan";
import type { ApproachWeights, TemplateBody } from "@/lib/types";
import { hasDoctorStep, mustBePrivate, needsDoctorStep, validateTemplate, type ClaimHit } from "@/lib/marketplace/template-schema";

export interface SamplePerson {
  label: string;
  weeks: number | null; // null = open-ended
  readiness: Record<string, number>;
  approach: ApproachWeights;
}

export const SAMPLE_PEOPLE: SamplePerson[] = [
  { label: "Ready, 12 weeks, habit builder", weeks: 12, readiness: { time: 5, energy: 4, money: 5, support: 4, focus: 4 }, approach: { habit: 0.4, willpower: 0.15, time: 0.15, reward: 0.15, resource: 0.15 } },
  { label: "Busy, 6 weeks, time manager", weeks: 6, readiness: { time: 2, energy: 3, money: 3, support: 2, focus: 2 }, approach: { habit: 0.15, willpower: 0.1, time: 0.45, reward: 0.15, resource: 0.15 } },
  { label: "Low readiness, open-ended, resource planner", weeks: null, readiness: { time: 1, energy: 2, money: 1, support: 1, focus: 2 }, approach: { habit: 0.1, willpower: 0.1, time: 0.15, reward: 0.15, resource: 0.5 } },
];

export interface PlanSample {
  person: string;
  totalWeeks: number;
  itemCount: number;
  firstWeek: Pick<DraftItem, "title" | "kind" | "due_date" | "required">[];
  realistic: boolean;
}

const addDays = (iso: string, n: number) => new Date(new Date(iso + "T00:00:00Z").getTime() + n * 86_400_000).toISOString().slice(0, 10);

export function planSamples(body: TemplateBody, startDate: string): PlanSample[] {
  return SAMPLE_PEOPLE.map((p) => {
    const { items, totalWeeks } = buildPlan({
      template: body, title: body.name, area: body.area, startDate,
      finishDate: p.weeks ? addDays(startDate, p.weeks * 7 - 1) : null,
      approach: p.approach, readiness: p.readiness,
    });
    const firstWeek = items.filter((i) => i.week === 1).map(({ title, kind, due_date, required }) => ({ title, kind, due_date, required }));
    const work = firstWeek.filter((i) => i.kind !== "guardrail" && i.kind !== "checkin");
    // Realistic: something to do in week one, not an overwhelming list, and at least one checkpoint overall.
    const realistic = work.length >= 1 && firstWeek.length <= 20 && items.some((i) => i.kind === "benchmark");
    return { person: p.label, totalWeeks, itemCount: items.length, firstWeek, realistic };
  });
}

export interface AutoChecks {
  schema: { ok: boolean; errors: string[] };
  planTest: { ok: boolean; samples: PlanSample[] };
  claims: { ok: boolean; hits: ClaimHit[] };
  doctorStep: { ok: boolean; needed: boolean };
  visibility: { ok: boolean; offenders: string[] };
}

export function autoChecks(input: unknown, startDate: string): AutoChecks {
  const v = validateTemplate(input);
  const body = v.body;
  const samples = body ? planSamples(body, startDate) : [];
  const needed = body ? needsDoctorStep(body) : false;
  const offenders = body ? body.tracked_fields.filter((f) => mustBePrivate(body.area, f) && f.default_visibility !== "private").map((f) => f.label) : [];
  return {
    schema: { ok: !!body, errors: body ? [] : v.errors },
    planTest: { ok: samples.length === 3 && samples.every((s) => s.realistic), samples },
    claims: { ok: !!body && v.claims.length === 0, hits: v.claims },
    doctorStep: { ok: !!body && (!needed || hasDoctorStep(body)), needed },
    visibility: { ok: !!body && offenders.length === 0, offenders },
  };
}

export const MANUAL_CHECKS = [
  { id: "claims_manual", label: "I read it all: no medical, financial or guaranteed-result claims" },
  { id: "original_rights", label: "Original content; the creator has the rights to everything in it" },
  { id: "price_refund", label: "Price is set and the refund policy is shown" },
] as const;
