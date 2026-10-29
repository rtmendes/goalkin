import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import { serverEnv } from "@/lib/env";
import { APPROACHES } from "@/lib/approach";
import { buildPlan, requiredGuardrails, type DraftItem } from "@/lib/plan";
import type { ApproachWeights, TemplateBody, Tone } from "@/lib/types";

// The AI drafts; the person decides. Everything returned here lands in an
// editable plan, and guardrail steps are re-added after the AI so they can
// never be dropped or reworded.

const SYSTEM = `You draft personal goal plans for GoalKin, a goal-accountability app.
Rules you must follow:
- Plans are suggestions the person will edit. Write concrete, small, doable actions.
- Never make medical, financial, legal or guaranteed-result claims. No diagnoses, dosages, calorie or supplement prescriptions, investment picks or income promises.
- For health, diet, weight or supplement goals, assume a "talk to your doctor" step already exists; do not repeat it or give medical guidance.
- Fit the plan to the person's approach weights, readiness and available time. Low readiness means a smaller first phase.
- Match the requested tone in titles only lightly; clarity first.`;

const PlanSchema = z.object({
  items: z.array(
    z.object({
      week: z.number().int().min(1),
      day_offset: z.number().int().min(0).max(6).describe("Day within the week, 0 = week start"),
      title: z.string().max(140),
      kind: z.enum(["action", "session", "benchmark", "checkin", "milestone", "reward", "gather"]),
      notes: z.string().max(280).optional(),
      duration_min: z.number().int().min(0).max(480).optional(),
    }),
  ),
  if_then: z.array(z.object({ if: z.string().max(140), then: z.string().max(140) })).max(4),
  summary: z.string().max(400),
});

const SharpenSchema = z.object({ options: z.array(z.string().max(120)).length(3) });

function client() {
  const key = serverEnv().anthropicKey;
  return key ? new Anthropic({ apiKey: key }) : null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(new Date(s + "T00:00:00Z").getTime() + n * 86_400_000));

export interface PlanRequest {
  title: string;
  why?: string | null;
  area?: string | null;
  template: TemplateBody | null;
  answers: Record<string, unknown>;
  startDate: string;
  finishDate?: string | null;
  approach?: ApproachWeights | null;
  readiness?: Record<string, number>;
  tone: Tone;
  minutesPerWeek?: number | null;
  firstWeekScale?: number;
  deeper?: boolean; // advanced custom template interview
}

export interface PlanResult {
  items: DraftItem[];
  ifThen: { if: string; then: string }[];
  summary: string;
  source: "ai" | "template";
  totalWeeks: number;
}

export async function draftPlan(req: PlanRequest): Promise<PlanResult> {
  const base = buildPlan({
    template: req.template, title: req.title, area: req.area, startDate: req.startDate, finishDate: req.finishDate,
    approach: req.approach, readiness: req.readiness, firstWeekScale: req.firstWeekScale,
  });
  const fallback: PlanResult = {
    items: base.items, totalWeeks: base.totalWeeks, source: "template",
    ifThen: [{ if: "I miss a planned day", then: "I do a 10-minute version the next day" }],
    summary: `${base.totalWeeks}-week plan built from ${req.template ? `the ${req.template.name} template` : "a starter structure"}. Edit anything.`,
  };
  const anthropic = client();
  if (!anthropic) return fallback;

  const approachLine = req.approach
    ? APPROACHES.map((a) => `${a.name} ${Math.round((req.approach![a.id] ?? 0) * 100)}% (${a.changes})`).join("; ")
    : "unknown";
  const prompt = [
    `Goal: ${req.title}`,
    req.why ? `Why it matters: ${req.why}` : "",
    `Area: ${req.area ?? req.template?.area ?? "unspecified"}`,
    `Dates: ${req.startDate} to ${req.finishDate ?? "open-ended"} (${base.totalWeeks} weeks)`,
    req.minutesPerWeek ? `Time available: about ${req.minutesPerWeek} minutes per week` : "",
    `Tone: ${req.tone}`,
    `Approach blend: ${approachLine}`,
    `Readiness (1-5): ${JSON.stringify(req.readiness ?? {})}`,
    `First-week size: ${Math.round((req.firstWeekScale ?? 1) * 100)}%`,
    `Onboarding answers: ${JSON.stringify(req.answers)}`,
    req.template ? `Template blueprint: ${JSON.stringify(req.template.plan_blueprint)}` : "",
    req.template?.approach_variants ? `Approach variants: ${JSON.stringify(req.template.approach_variants)}` : "",
    req.deeper ? "This is an advanced custom plan: include phases, weekly benchmarks, restart rules as items, milestone rewards and partner roles." : "",
    `Return weekly items for every week (1 to ${base.totalWeeks}); 2 to 5 items per week; one benchmark at the end of each phase.`,
  ].filter(Boolean).join("\n");

  try {
    const res = await anthropic.beta.messages.parse({
      model: serverEnv().aiModel,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: zodOutputFormat(PlanSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return fallback;
    const out = res.parsed_output;
    const guardrails = requiredGuardrails(req.area ?? req.template?.area, req.template);
    const items: DraftItem[] = [
      ...guardrails.map((g, i) => ({
        week: 1, due_date: req.startDate, starts_at: null, duration_min: null, title: g, notes: null,
        kind: "guardrail" as const, source: "template" as const, required: true, sort: i,
      })),
      ...out.items
        .filter((i) => i.week <= base.totalWeeks)
        .map((i, idx) => ({
          week: i.week,
          due_date: addDays(req.startDate, (i.week - 1) * 7 + i.day_offset),
          starts_at: null,
          duration_min: i.duration_min ?? null,
          title: i.title,
          notes: i.notes ?? null,
          kind: i.kind,
          source: "ai" as const,
          required: false,
          sort: guardrails.length + idx,
        })),
    ];
    return { items, ifThen: out.if_then, summary: out.summary, source: "ai", totalWeeks: base.totalWeeks };
  } catch (err) {
    console.error("draftPlan failed, using template plan", err instanceof Anthropic.APIError ? err.status : err);
    return fallback;
  }
}

/** Onboarding step 2: three sharper versions of the person's sentence. */
export async function sharpenGoal(sentence: string, area?: string | null): Promise<string[]> {
  const trimmed = sentence.trim().replace(/\.$/, "");
  const fallback = [
    `${trimmed} by ${new Date(new Date().getFullYear(), 11, 31).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    `${trimmed}, a little each week`,
    `Finish the first step toward: ${trimmed.toLowerCase()}`,
  ];
  const anthropic = client();
  if (!anthropic || !trimmed) return fallback;
  try {
    const res = await anthropic.beta.messages.parse({
      model: serverEnv().aiModel,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: zodOutputFormat(SharpenSchema) },
      system: "Rewrite a personal goal three ways: specific, measurable where natural, with a timeframe. Under 15 words each. No medical, financial or guaranteed-result claims.",
      messages: [{ role: "user", content: `Area: ${area ?? "any"}\nGoal: ${trimmed}` }],
    });
    return res.parsed_output?.options ?? fallback;
  } catch {
    return fallback;
  }
}
