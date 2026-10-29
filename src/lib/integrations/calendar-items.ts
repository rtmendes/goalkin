// What goes on a person's calendar, shared by the ICS feed and Google sync.
import type { Goal, PlanItem } from "@/lib/types";
import type { IcsEvent } from "@/lib/integrations/ics";
import { daysBetween, localDay, shiftDay } from "@/lib/integrations/time";

/** Calendars carry the last 14 days and the next 120. */
export function syncWindow(today: string) {
  return { from: shiftDay(today, -14), to: shiftDay(today, 120) };
}

export type CalItem = Pick<PlanItem, "id" | "goal_id" | "title" | "notes" | "kind" | "due_date" | "starts_at" | "duration_min" | "done" | "required">;
export type CalGoal = Pick<Goal, "id" | "title" | "start_date" | "finish_date">;

/** The local calendar day an item belongs to, or null if it has no date at all. */
export function itemDay(item: Pick<PlanItem, "due_date" | "starts_at">, tz: string): string | null {
  if (item.starts_at) return localDay(new Date(item.starts_at), tz);
  return item.due_date;
}

export function inWindow(day: string | null, w: { from: string; to: string }): day is string {
  return !!day && day >= w.from && day <= w.to;
}

export function itemSummary(item: CalItem, goal: CalGoal): string {
  return `${item.done ? "✓ " : ""}${item.title} · ${goal.title}`;
}

export function itemDescription(item: CalItem, goal: CalGoal, checkinLink: string, appUrl: string): string {
  const lines = [`Goal: ${goal.title}`];
  if (item.notes) lines.push(item.notes);
  if (item.required) lines.push("Required step: it can be completed, not removed.");
  lines.push("", `Check in with one tap: ${checkinLink}`, `Open GoalKin: ${appUrl}/app/goals/${goal.id}`);
  return lines.join("\n");
}

export function planItemToIcs(item: CalItem, goal: CalGoal, opts: { tz: string; checkinLink: string; appUrl: string }): IcsEvent | null {
  const start = item.starts_at ? { dateTime: new Date(item.starts_at) } : item.due_date ? { date: item.due_date } : null;
  if (!start) return null;
  return {
    uid: `item-${item.id}@goalkin.app`,
    summary: itemSummary(item, goal),
    description: itemDescription(item, goal, opts.checkinLink, opts.appUrl),
    url: `${opts.appUrl}/app/goals/${goal.id}`,
    start,
    durationMin: item.duration_min,
    categories: ["GoalKin", item.kind],
  };
}

/**
 * Weekly all-day check-in events for goals whose plan has no check-in items of
 * its own (template plans already include a "Weekly check-in" each week). One
 * event per week rather than an RRULE, so each carries a link for its own day.
 */
export function weeklyCheckinEvents(
  goal: CalGoal,
  window: { from: string; to: string },
  opts: { linkFor: (day: string) => string; appUrl: string },
): IcsEvent[] {
  const out: IcsEvent[] = [];
  const last = goal.finish_date && goal.finish_date < window.to ? goal.finish_date : window.to;
  let day = shiftDay(goal.start_date, 6);
  if (day < window.from) day = shiftDay(day, Math.ceil(daysBetween(day, window.from) / 7) * 7);
  for (; day <= last; day = shiftDay(day, 7)) {
    out.push({
      uid: `checkin-${goal.id}-${day}@goalkin.app`,
      summary: `Weekly check-in · ${goal.title}`,
      description: `How did this week go?\n\nCheck in with one tap: ${opts.linkFor(day)}\nOpen GoalKin: ${opts.appUrl}/app/goals/${goal.id}`,
      url: `${opts.appUrl}/app/goals/${goal.id}`,
      start: { date: day },
      categories: ["GoalKin", "checkin"],
    });
  }
  return out;
}
