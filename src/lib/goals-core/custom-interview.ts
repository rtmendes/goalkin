// Advanced custom template: a deeper interview (Pro). Answers go to the AI with
// `deeper: true`; the person edits the draft and saves it as a personal template.

import type { TemplateBody } from "@/lib/types";

export const CUSTOM_QUESTIONS: { id: string; prompt: string; type: "text" | "number" | "choice"; options?: string[]; optional?: boolean }[] = [
  { id: "goal", prompt: "What's the goal, in one sentence?", type: "text" },
  { id: "finish", prompt: "What does finished look like? How will you know?", type: "text" },
  { id: "weeks", prompt: "How many weeks do you want this to run?", type: "number" },
  { id: "now", prompt: "Where are you starting from today?", type: "text" },
  { id: "tried", prompt: "What have you tried before, and what got in the way?", type: "text", optional: true },
  { id: "minutes", prompt: "Minutes per week you can honestly give it?", type: "number" },
  { id: "best_days", prompt: "Which days and times work best?", type: "text", optional: true },
  { id: "measures", prompt: "What would you like to count or track?", type: "text", optional: true },
  { id: "milestones", prompt: "Any milestones along the way?", type: "text", optional: true },
  { id: "rewards", prompt: "How will you reward yourself at each milestone?", type: "text", optional: true },
  { id: "obstacles", prompt: "What's most likely to knock you off course?", type: "text", optional: true },
  { id: "restart", prompt: "If you miss a week, what should the restart look like?", type: "choice", options: ["Half-size week", "Pick up where I left off", "Re-plan the rest"] },
  { id: "partner", prompt: "Who could be in your corner, and what role would help?", type: "text", optional: true },
  { id: "resources", prompt: "Anything you need to gather first (money, tools, people, skills)?", type: "text", optional: true },
];

export interface CustomItem {
  week: number;
  title: string;
  kind: "action" | "session" | "benchmark" | "checkin" | "milestone" | "reward" | "gather" | "guardrail";
  notes?: string | null;
}

/**
 * Turn an edited plan into a template body. Each week becomes its own phase so
 * the person's edits survive exactly; guardrails are kept as template guardrails.
 */
export function bodyFromCustomPlan(input: { id: string; name: string; area: string; summary: string; items: CustomItem[]; restart?: string | null }): TemplateBody {
  const weeks = [...new Set(input.items.filter((i) => i.kind !== "guardrail").map((i) => i.week))].sort((a, b) => a - b);
  return {
    id: input.id,
    name: input.name,
    area: input.area,
    tier: "Custom",
    price: 0,
    summary: input.summary,
    duration: weeks.length ? `${weeks[weeks.length - 1]} weeks` : undefined,
    onboarding: [],
    plan_blueprint: {
      phases: weeks.map((w) => {
        const these = input.items.filter((i) => i.week === w && i.kind !== "guardrail");
        return {
          name: `Week ${w}`,
          weeks: `${w}-${w}`,
          actions: these.filter((i) => i.kind !== "benchmark" && i.kind !== "checkin").map((i) => i.title),
          benchmarks: these.filter((i) => i.kind === "benchmark").map((i) => i.title),
        };
      }),
    },
    tracked_fields: [],
    guardrails: input.items.filter((i) => i.kind === "guardrail").map((i) => i.title),
    restart_rules: input.restart ?? undefined,
  };
}
