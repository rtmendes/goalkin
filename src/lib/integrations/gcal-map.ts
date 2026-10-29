// Pure mapping between plan items and Google Calendar event resources
// (https://developers.google.com/workspace/calendar/api/v3/reference/events).
import { addDays } from "@/lib/integrations/ics";
import { itemDescription, itemSummary, type CalGoal, type CalItem } from "@/lib/integrations/calendar-items";
import { localDay } from "@/lib/integrations/time";

export interface GDateTime { date?: string; dateTime?: string; timeZone?: string }

export interface GEvent {
  id?: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  start?: GDateTime;
  end?: GDateTime;
  updated?: string;
  colorId?: string;
  transparency?: "opaque" | "transparent";
  extendedProperties?: { private?: Record<string, string> };
  source?: { title: string; url: string };
}

/** Google event colours: "2" sage for done, "5" banana for milestones and benchmarks. */
function colorFor(item: CalItem): string | undefined {
  if (item.done) return "2";
  if (item.kind === "milestone" || item.kind === "benchmark") return "5";
  return undefined;
}

export function itemToEvent(item: CalItem, goal: CalGoal, opts: { tz: string; checkinLink: string; appUrl: string }): GEvent | null {
  let start: GDateTime;
  let end: GDateTime;
  if (item.starts_at) {
    const s = new Date(item.starts_at);
    const e = new Date(s.getTime() + (item.duration_min && item.duration_min > 0 ? item.duration_min : 30) * 60_000);
    start = { dateTime: s.toISOString(), timeZone: opts.tz };
    end = { dateTime: e.toISOString(), timeZone: opts.tz };
  } else if (item.due_date) {
    start = { date: item.due_date };
    end = { date: addDays(item.due_date, 1) };
  } else {
    return null;
  }
  const ev: GEvent = {
    summary: itemSummary(item, goal),
    description: itemDescription(item, goal, opts.checkinLink, opts.appUrl),
    start,
    end,
    transparency: item.starts_at ? "opaque" : "transparent",
    extendedProperties: { private: { gkItemId: item.id, gkGoalId: goal.id } },
    source: { title: "GoalKin", url: `${opts.appUrl}/app/goals/${goal.id}` },
  };
  const color = colorFor(item);
  if (color) ev.colorId = color;
  return ev;
}

const instant = (d?: GDateTime) => (d?.dateTime ? Date.parse(d.dateTime) : null);

function sameTime(a?: GDateTime, b?: GDateTime): boolean {
  if (a?.date || b?.date) return a?.date === b?.date && !a?.dateTime && !b?.dateTime;
  return instant(a) === instant(b);
}

/** Does the existing Google event need a patch to match what the app wants? */
export function eventDiffers(desired: GEvent, existing: GEvent): boolean {
  return (
    desired.summary !== existing.summary ||
    (desired.description ?? "") !== (existing.description ?? "") ||
    !sameTime(desired.start, existing.start) ||
    !sameTime(desired.end, existing.end) ||
    (desired.colorId ?? "") !== (existing.colorId ?? "")
  );
}

export type ItemTimeUpdate = { starts_at: string | null; due_date: string; duration_min: number | null };

/**
 * Two-way sync: when the person moved the event in Google, the new time goes
 * back onto the plan item. Returns null when the item already matches.
 */
export function eventToItemUpdate(ev: GEvent, item: Pick<CalItem, "starts_at" | "due_date" | "duration_min">, tz: string): ItemTimeUpdate | null {
  if (ev.start?.dateTime) {
    const s = new Date(ev.start.dateTime);
    const e = ev.end?.dateTime ? new Date(ev.end.dateTime) : null;
    const duration = e ? Math.max(5, Math.round((e.getTime() - s.getTime()) / 60_000)) : item.duration_min;
    const same = item.starts_at && Date.parse(item.starts_at) === s.getTime() && (item.duration_min ?? 30) === (duration ?? 30);
    if (same) return null;
    return { starts_at: s.toISOString(), due_date: localDay(s, tz), duration_min: duration ?? null };
  }
  if (ev.start?.date) {
    if (!item.starts_at && item.due_date === ev.start.date) return null;
    return { starts_at: null, due_date: ev.start.date, duration_min: item.duration_min };
  }
  return null;
}

/** Google changed the event after our last sync, so its time wins over ours. */
export function googleEditedSince(ev: GEvent, lastSyncAt: string | null): boolean {
  if (!lastSyncAt || !ev.updated) return false;
  return Date.parse(ev.updated) > Date.parse(lastSyncAt);
}
