// Reminders engine. Pure decisions only; the cron route does the I/O.
// Rules: send at or after the reminder's local time, on the right days, never
// inside the person's quiet hours, and at most once per local day.
import type { CheckIn, PlanItem } from "@/lib/types";
import { daysBetween, localDay, localParts, timeToMinutes } from "@/lib/integrations/time";

export interface ReminderRow {
  id: string;
  goal_id: string;
  user_id: string;
  channel: "email" | "push" | "calendar";
  cadence: "daily" | "weekdays" | "weekly";
  time_of_day: string;
  weekday: number | null;
  active: boolean;
  last_sent_at: string | null;
}

export interface QuietHours {
  quiet_start: string | null;
  quiet_end: string | null;
}

/** Quiet hours wrap past midnight when start > end (21:00 → 07:00). Equal times mean none. */
export function inQuietHours(minutes: number, q: QuietHours): boolean {
  const s = timeToMinutes(q.quiet_start);
  const e = timeToMinutes(q.quiet_end);
  if (s === null || e === null || s === e) return false;
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

export function cadenceMatches(r: Pick<ReminderRow, "cadence" | "weekday">, weekday: number): boolean {
  if (r.cadence === "weekdays") return weekday >= 1 && weekday <= 5;
  if (r.cadence === "weekly") return weekday === (r.weekday ?? 1);
  return true;
}

export type DueReason = "due" | "inactive" | "calendar_channel" | "wrong_day" | "too_early" | "quiet_hours" | "already_sent";

export function reminderDue(input: { reminder: ReminderRow; timezone: string; quiet: QuietHours; now: Date }): DueReason {
  const { reminder: r, timezone, quiet, now } = input;
  if (!r.active) return "inactive";
  // Calendar reminders live in the person's calendar app, not in our sender.
  if (r.channel === "calendar") return "calendar_channel";
  const local = localParts(now, timezone);
  if (!cadenceMatches(r, local.weekday)) return "wrong_day";
  const at = timeToMinutes(r.time_of_day) ?? 8 * 60;
  if (local.minutes < at) return "too_early";
  if (inQuietHours(local.minutes, quiet)) return "quiet_hours";
  if (r.last_sent_at && localDay(new Date(r.last_sent_at), timezone) === local.date) return "already_sent";
  return "due";
}

export const isDue = (input: Parameters<typeof reminderDue>[0]) => reminderDue(input) === "due";

/** Days since the last done/partly check-in, not counting today. 0 when on a run or brand new. */
export function missedDays(checkIns: Pick<CheckIn, "day" | "status">[], today: string): number {
  const active = checkIns.filter((c) => c.status !== "missed" && c.day <= today).map((c) => c.day).sort();
  const last = active[active.length - 1];
  if (!last) return 0;
  return Math.max(0, daysBetween(last, today) - 1);
}

/** Today's first open item, else the next upcoming one. Undated items come last. */
export function nextPlanItem<T extends Pick<PlanItem, "title" | "done" | "due_date" | "starts_at" | "sort" | "week">>(items: T[], today: string, tz: string): T | null {
  const dayOf = (i: T) => (i.starts_at ? localDay(new Date(i.starts_at), tz) : i.due_date);
  const open = items.filter((i) => !i.done && (dayOf(i) ?? "9999") >= today);
  open.sort((a, b) => (dayOf(a) ?? "9999").localeCompare(dayOf(b) ?? "9999") || (a.starts_at ?? "").localeCompare(b.starts_at ?? "") || a.week - b.week || a.sort - b.sort);
  return open[0] ?? null;
}

/** Weekly recap: Sunday evening (from 17:00 local), outside quiet hours. */
export function weeklyRecapDue(now: Date, timezone: string, quiet: QuietHours): boolean {
  const local = localParts(now, timezone);
  return local.weekday === 0 && local.minutes >= 17 * 60 && !inQuietHours(local.minutes, quiet);
}

/** ISO-ish week key (the Sunday's local date) used to send each recap once. */
export const recapKey = (now: Date, timezone: string) => localDay(now, timezone);

export const QUIET_PARTNER_DAYS = 4;

/** A partner "went quiet" after this many days without any check-in they can see. */
export function partnerWentQuiet(lastVisibleCheckIn: string | null, today: string): number | null {
  if (!lastVisibleCheckIn) return null;
  const gap = daysBetween(lastVisibleCheckIn, today);
  return gap >= QUIET_PARTNER_DAYS ? gap : null;
}
