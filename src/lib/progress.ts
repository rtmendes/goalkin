// Progress math. Missing a day never deletes progress: the streak uses a
// recovery rule (one missed day is forgiven when the next check-in is done),
// and percent counts what was done, never subtracts.

import type { CheckIn, Goal, GoalField, PlanItem } from "@/lib/types";

const DAY = 86_400_000;
export const toDay = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T00:00:00Z");

export function streakWithRecovery(checkIns: Pick<CheckIn, "day" | "status">[], today = new Date()): number {
  const byDay = new Map(checkIns.map((c) => [c.day, c.status]));
  let streak = 0;
  let forgiven = false;
  let cursor = parse(toDay(today));
  // Today not checked in yet does not break the streak.
  if (!byDay.has(toDay(cursor))) cursor = new Date(cursor.getTime() - DAY);
  for (let i = 0; i < 3660; i++) {
    const s = byDay.get(toDay(cursor));
    if (s === "done" || s === "partly") {
      streak++;
      forgiven = false;
    } else if (!forgiven && streak > 0) {
      // Recovery rule: a single gap is forgiven if the person came back after it.
      forgiven = true;
    } else {
      break;
    }
    cursor = new Date(cursor.getTime() - DAY);
  }
  return streak;
}

export function computeProgress(input: {
  goal: Pick<Goal, "start_date" | "finish_date" | "status">;
  checkIns: Pick<CheckIn, "day" | "status" | "values">[];
  planItems: Pick<PlanItem, "done" | "kind" | "due_date">[];
  fields: Pick<GoalField, "key" | "target" | "kind">[];
  today?: Date;
}) {
  const today = input.today ?? new Date();
  const { goal, checkIns, planItems, fields } = input;
  const streak = streakWithRecovery(checkIns, today);

  // Percent: a numeric field with a target wins; otherwise plan items done.
  let percent = 0;
  const targeted = fields.find((f) => f.target && ["number", "money", "duration", "percent"].includes(f.kind));
  if (targeted?.target) {
    const total = checkIns.reduce((s, c) => s + (Number(c.values?.[targeted.key]) || 0), 0);
    percent = targeted.kind === "percent"
      ? Math.max(0, ...checkIns.map((c) => Number(c.values?.[targeted.key]) || 0))
      : (total / targeted.target) * 100;
  } else {
    const countable = planItems.filter((p) => p.kind !== "guardrail");
    if (countable.length) percent = (countable.filter((p) => p.done).length / countable.length) * 100;
  }
  percent = Math.round(Math.min(100, Math.max(0, percent)));

  // Expected percent by date, to say on track or behind.
  let status: "on_track" | "behind" | "finished" | "not_started" = "on_track";
  const start = parse(goal.start_date).getTime();
  if (goal.status === "finished") status = "finished";
  else if (today.getTime() < start) status = "not_started";
  else if (goal.finish_date) {
    const end = parse(goal.finish_date).getTime();
    const expected = end > start ? ((today.getTime() - start) / (end - start)) * 100 : 100;
    // A 10-point cushion so one slow week does not flip someone to "behind".
    status = percent + 10 >= Math.min(100, expected) ? "on_track" : "behind";
  }

  const weekAgo = toDay(new Date(today.getTime() - 6 * DAY));
  const thisWeek = checkIns.filter((c) => c.day >= weekAgo);
  const scorecard = {
    done: thisWeek.filter((c) => c.status === "done").length,
    partly: thisWeek.filter((c) => c.status === "partly").length,
    missed: thisWeek.filter((c) => c.status === "missed").length,
  };
  return { percent, status, streak, scorecard };
}

/** After missed days, offer a gentle restart instead of a broken record. */
export function restartPlan(missedDays: number): string[] {
  if (missedDays <= 1) return ["Pick up where you left off today. One missed day changes nothing."];
  if (missedDays <= 3) return ["Do a half-size version of today's action.", "Move one missed item to your next open slot.", "Tell one person in your corner you're back."];
  return [
    "Restart week: this week runs at half size so you can find your rhythm.",
    "Pick the single most important action and do only that for three days.",
    "Re-read why this matters to you.",
    "Check that your plan still fits your week; shrink it if it doesn't.",
  ];
}
