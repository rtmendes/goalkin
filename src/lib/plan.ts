// Deterministic plan builder. It turns a template blueprint plus the person's
// answers, approach weights and readiness into dated plan items. The AI layer
// (src/lib/ai.ts) may rewrite wording, but this always produces a usable plan,
// and the guardrail steps are added here so the AI can never drop them.

import type { ApproachWeights, PlanItem, TemplateBody } from "@/lib/types";
import { readinessScale, topApproaches } from "@/lib/approach";

export type DraftItem = Omit<PlanItem, "id" | "goal_id" | "done" | "done_at" | "gcal_event_id">;

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(new Date(s + "T00:00:00Z").getTime() + n * DAY));

export const DOCTOR_STEP = "Talk to your doctor before starting. GoalKin offers education, not medical advice.";
export const MONEY_NOTICE = "This plan is general education, not financial advice. Check big decisions with a qualified professional.";

export function requiredGuardrails(area: string | null | undefined, template?: Pick<TemplateBody, "guardrails"> | null): string[] {
  const out = new Set<string>(template?.guardrails ?? []);
  const a = (area ?? "").toLowerCase();
  if (a === "health" && ![...out].some((g) => /doctor|clinician/i.test(g))) out.add(DOCTOR_STEP);
  if (a === "wealth" && ![...out].some((g) => /financial advice/i.test(g))) out.add(MONEY_NOTICE);
  return [...out];
}

export function parseWeeks(range: string): [number, number] {
  const m = range.match(/(\d+)\s*(?:-|to|–)\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  const n = range.match(/(\d+)/);
  return n ? [Number(n[1]), Number(n[1])] : [1, 1];
}

export function weeksBetween(start: string, finish: string | null | undefined, fallback: number): number {
  if (!finish) return fallback;
  const w = Math.ceil((new Date(finish + "T00:00:00Z").getTime() - new Date(start + "T00:00:00Z").getTime() + DAY) / (7 * DAY));
  return Math.max(1, Math.min(104, w));
}

const APPROACH_EXTRAS: Record<string, (week: number, total: number) => { title: string; kind: DraftItem["kind"] } | null> = {
  habit: (w) => (w === 1 ? { title: "Stack it: attach today's action to something you already do daily (after coffee, after brushing teeth).", kind: "action" } : null),
  willpower: (w, t) => (w === Math.max(1, Math.round(t / 2)) ? { title: "Halfway challenge: beat your best week so far.", kind: "milestone" } : null),
  time: (w) => ({ title: `Week ${w} review: compare planned vs actual time (10 minutes).`, kind: "checkin" }),
  reward: (w, t) => (w % 4 === 0 || w === t ? { title: "Milestone reward: claim the treat you picked for this stretch.", kind: "reward" } : null),
  resource: (w) => (w === 1 ? { title: "Gather first: list the money, tools, people and skills you need, and get the first one.", kind: "gather" } : null),
};

export function buildPlan(input: {
  template: TemplateBody | null;
  title: string;
  area?: string | null;
  startDate: string;
  finishDate?: string | null;
  approach?: ApproachWeights | null;
  readiness?: Record<string, number>;
  firstWeekScale?: number; // from the first_week_size split test
}): { items: DraftItem[]; totalWeeks: number; clearPath: string[] } {
  const { template, startDate } = input;
  const phases = template?.plan_blueprint.phases?.length
    ? template.plan_blueprint.phases
    : [
        { name: "Get going", weeks: "1-2", benchmarks: ["Do the first action three times"], actions: ["Do the smallest useful version of the work"] },
        { name: "Build", weeks: "3-8", benchmarks: ["Hit your weekly target most weeks"], actions: ["Weekly work session", "Note what moved you forward"] },
        { name: "Finish", weeks: "9-10", benchmarks: ["Reach the goal"], actions: ["Final push", "Celebrate and reflect"] },
      ];
  const blueprintWeeks = Math.max(...phases.map((p) => parseWeeks(p.weeks)[1]));
  const totalWeeks = weeksBetween(startDate, input.finishDate, blueprintWeeks);
  const scale = totalWeeks / blueprintWeeks;
  const ready = readinessScale(input.readiness ?? {});
  const firstScale = Math.min(ready.firstPhaseScale, input.firstWeekScale ?? 1);
  const approaches = input.approach ? topApproaches(input.approach, 2) : [];

  const items: DraftItem[] = [];
  let sort = 0;
  const push = (i: Omit<DraftItem, "sort" | "starts_at" | "duration_min" | "notes"> & Partial<DraftItem>) =>
    items.push({ starts_at: null, duration_min: null, notes: null, ...i, sort: sort++ });

  for (const g of requiredGuardrails(input.area ?? template?.area, template)) {
    push({ week: 1, due_date: startDate, title: g, kind: "guardrail", source: "template", required: true });
  }
  for (const step of ready.clearPath) push({ week: 1, due_date: addDays(startDate, 2), title: step, kind: "gather", source: "ai", required: false });

  phases.forEach((phase) => {
    const [a, b] = parseWeeks(phase.weeks);
    const from = Math.max(1, Math.round((a - 1) * scale) + 1);
    const to = Math.max(from, Math.min(totalWeeks, Math.round(b * scale)));
    for (let w = from; w <= to; w++) {
      const weekStart = addDays(startDate, (w - 1) * 7);
      const small = w === 1 && firstScale < 1;
      for (const act of phase.actions ?? []) {
        push({
          week: w, due_date: addDays(weekStart, 1), source: "template", required: false, kind: "session",
          title: small ? `${act} (starter size, about ${Math.round(firstScale * 100)}%)` : act,
          notes: phase.name,
        });
      }
      // Benchmarks land at the end of the phase so each one is a real checkpoint.
      if (w === to) {
        for (const bm of phase.benchmarks ?? []) {
          push({ week: w, due_date: addDays(weekStart, 6), title: bm, kind: "benchmark", source: "template", required: false, notes: phase.name });
        }
      }
      push({ week: w, due_date: addDays(weekStart, 6), title: "Weekly check-in", kind: "checkin", source: "template", required: false });
      for (const ap of approaches) {
        const extra = APPROACH_EXTRAS[ap]?.(w, totalWeeks);
        if (extra && (ap !== "time" || w % 1 === 0)) push({ week: w, due_date: addDays(weekStart, 6), title: extra.title, kind: extra.kind, source: "ai", required: false });
      }
    }
  });
  return { items, totalWeeks, clearPath: ready.clearPath };
}

/** Guardrail items may be completed but never deleted. */
export function canDeletePlanItem(item: Pick<PlanItem, "required">) {
  return !item.required;
}
