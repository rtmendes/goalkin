// Small date and progress helpers for the goals screens. Dates are plain
// yyyy-mm-dd strings in the person's own time zone.

import type { CheckIn, GoalField, PlanItem, Tone } from "@/lib/types";

const DAY = 86_400_000;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIn(timeZone: string | null | undefined, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function hourIn(timeZone: string | null | undefined, now = new Date()): number {
  try {
    return Number(new Intl.DateTimeFormat("en-US", { timeZone: timeZone || "UTC", hour: "numeric", hourCycle: "h23" }).format(now)) % 24;
  } catch {
    return now.getUTCHours();
  }
}

export const addDays = (day: string, n: number) => new Date(Date.parse(day + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY);

/** Week number (1-based) of `day` in a goal that starts on `start`. */
export const weekOf = (start: string, day: string) => Math.max(1, Math.floor(daysBetween(start, day) / 7) + 1);

/**
 * Days in a row, ending yesterday, with no "done" or "partly" check-in.
 * Never counts days before the goal started.
 */
export function missedDays(checkIns: Pick<CheckIn, "day" | "status">[], startDate: string, today: string): number {
  const good = new Set(checkIns.filter((c) => c.status !== "missed").map((c) => c.day));
  let n = 0;
  for (let d = addDays(today, -1); d >= startDate && n < 365; d = addDays(d, -1)) {
    if (good.has(d)) break;
    n++;
  }
  return n;
}

const NUMERIC: GoalField["kind"][] = ["number", "money", "duration", "percent"];

/** The field a chart should follow: one with a target first, else the first number. */
export function primaryField<F extends Pick<GoalField, "kind" | "target">>(fields: F[]): F | null {
  return fields.find((f) => f.target && NUMERIC.includes(f.kind)) ?? fields.find((f) => NUMERIC.includes(f.kind)) ?? null;
}

export interface WeekPoint {
  week: number;
  value: number;
  benchmarks: number;
  benchmarksDone: number;
}

/**
 * One point per week from the start to today: the week's total for the primary
 * field (or the count of done/partly days when there is no number to follow),
 * plus how many benchmarks were due that week and how many are done.
 */
export function weeklySeries(input: {
  startDate: string;
  today: string;
  checkIns: Pick<CheckIn, "day" | "status" | "values">[];
  planItems: Pick<PlanItem, "week" | "kind" | "done">[];
  field: Pick<GoalField, "key" | "kind"> | null;
  maxWeeks?: number;
}): WeekPoint[] {
  const last = Math.max(1, weekOf(input.startDate, input.today));
  const first = Math.max(1, last - (input.maxWeeks ?? 12) + 1);
  const out: WeekPoint[] = [];
  for (let w = first; w <= last; w++) {
    const days = input.checkIns.filter((c) => c.day >= input.startDate && weekOf(input.startDate, c.day) === w);
    const value = input.field
      ? input.field.kind === "percent"
        ? Math.max(0, ...days.map((c) => Number(c.values?.[input.field!.key]) || 0))
        : days.reduce((s, c) => s + (Number(c.values?.[input.field!.key]) || 0), 0)
      : days.filter((c) => c.status !== "missed").length;
    const bms = input.planItems.filter((p) => p.kind === "benchmark" && p.week === w);
    out.push({ week: w, value: Math.round(value * 100) / 100, benchmarks: bms.length, benchmarksDone: bms.filter((b) => b.done).length });
  }
  return out;
}

export function greeting(tone: Tone, name: string | null | undefined, hour: number): string {
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const n = name ? `, ${name}` : "";
  switch (tone) {
    case "gentle": return `Good ${part}${n}. Take it one small step at a time.`;
    case "drill": return `${name ? name + ". " : ""}Here's the list. Get moving.`;
    case "playful": return `Well hello${n}! Your goals have been waiting by the door.`;
    default: return `Good ${part}${n}. Here's today's play.`;
  }
}

export function formatDay(day: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  if (!day || !DATE_RE.test(day)) return "";
  return new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}
