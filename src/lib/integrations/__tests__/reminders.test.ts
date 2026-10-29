import { describe, expect, it } from "vitest";
import { cadenceMatches, inQuietHours, missedDays, nextPlanItem, partnerWentQuiet, reminderDue, weeklyRecapDue, type ReminderRow } from "@/lib/integrations/reminders";
import { localParts, timeToMinutes } from "@/lib/integrations/time";

const rem = (p: Partial<ReminderRow> = {}): ReminderRow => ({
  id: "r1", goal_id: "g1", user_id: "u1", channel: "email", cadence: "daily", time_of_day: "08:00:00", weekday: null, active: true, last_sent_at: null, ...p,
});
const quiet = { quiet_start: "21:00:00", quiet_end: "07:00:00" };
const NY = "America/New_York";

describe("time helpers", () => {
  it("reads local parts in a zone", () => {
    // 2026-11-02 is a Monday; 13:30Z is 08:30 in New York (EST, UTC-5).
    expect(localParts(new Date("2026-11-02T13:30:00Z"), NY)).toEqual({ date: "2026-11-02", weekday: 1, minutes: 8 * 60 + 30 });
    // Late UTC evening is still the previous evening in New York.
    expect(localParts(new Date("2026-11-03T02:00:00Z"), NY).date).toBe("2026-11-02");
  });
  it("parses Postgres times", () => {
    expect(timeToMinutes("08:15:00")).toBe(495);
    expect(timeToMinutes("bad")).toBeNull();
  });
});

describe("inQuietHours", () => {
  it("handles windows that wrap past midnight", () => {
    expect(inQuietHours(22 * 60, quiet)).toBe(true);
    expect(inQuietHours(6 * 60 + 59, quiet)).toBe(true);
    expect(inQuietHours(7 * 60, quiet)).toBe(false);
    expect(inQuietHours(12 * 60, quiet)).toBe(false);
  });
  it("handles same-day windows and equal times", () => {
    expect(inQuietHours(13 * 60, { quiet_start: "12:00", quiet_end: "14:00" })).toBe(true);
    expect(inQuietHours(15 * 60, { quiet_start: "12:00", quiet_end: "14:00" })).toBe(false);
    expect(inQuietHours(3 * 60, { quiet_start: "00:00", quiet_end: "00:00" })).toBe(false);
  });
});

describe("cadence", () => {
  it("matches daily, weekdays and weekly", () => {
    expect(cadenceMatches({ cadence: "daily", weekday: null }, 0)).toBe(true);
    expect(cadenceMatches({ cadence: "weekdays", weekday: null }, 6)).toBe(false);
    expect(cadenceMatches({ cadence: "weekdays", weekday: null }, 3)).toBe(true);
    expect(cadenceMatches({ cadence: "weekly", weekday: 4 }, 4)).toBe(true);
    expect(cadenceMatches({ cadence: "weekly", weekday: 4 }, 3)).toBe(false);
    expect(cadenceMatches({ cadence: "weekly", weekday: null }, 1)).toBe(true);
  });
});

describe("reminderDue", () => {
  const mondayAt = (hhmmUtc: string) => new Date(`2026-11-02T${hhmmUtc}:00Z`); // Monday; NY = UTC-5
  it("is due at or after the local time", () => {
    expect(reminderDue({ reminder: rem(), timezone: NY, quiet, now: mondayAt("12:59") })).toBe("too_early");
    expect(reminderDue({ reminder: rem(), timezone: NY, quiet, now: mondayAt("13:00") })).toBe("due");
    expect(reminderDue({ reminder: rem(), timezone: NY, quiet, now: mondayAt("18:00") })).toBe("due");
  });
  it("sends at most once per local day", () => {
    const sentEarlier = rem({ last_sent_at: "2026-11-02T13:05:00Z" });
    expect(reminderDue({ reminder: sentEarlier, timezone: NY, quiet, now: mondayAt("20:00") })).toBe("already_sent");
    // Sent late Sunday local time (01:00Z Monday is 20:00 Sunday in NY): Monday is a new day.
    const sentSunday = rem({ last_sent_at: "2026-11-02T01:00:00Z" });
    expect(reminderDue({ reminder: sentSunday, timezone: NY, quiet, now: mondayAt("13:15") })).toBe("due");
  });
  it("never sends inside quiet hours, even if late", () => {
    // 03:00Z Tuesday = 22:00 Monday in NY.
    expect(reminderDue({ reminder: rem(), timezone: NY, quiet, now: new Date("2026-11-03T03:00:00Z") })).toBe("quiet_hours");
  });
  it("respects cadence and active flags and skips calendar-only reminders", () => {
    const saturday = new Date("2026-11-07T15:00:00Z");
    expect(reminderDue({ reminder: rem({ cadence: "weekdays" }), timezone: NY, quiet, now: saturday })).toBe("wrong_day");
    expect(reminderDue({ reminder: rem({ cadence: "weekly", weekday: 6 }), timezone: NY, quiet, now: saturday })).toBe("due");
    expect(reminderDue({ reminder: rem({ active: false }), timezone: NY, quiet, now: saturday })).toBe("inactive");
    expect(reminderDue({ reminder: rem({ channel: "calendar" }), timezone: NY, quiet, now: saturday })).toBe("calendar_channel");
  });
  it("uses the person's zone, not UTC, for the weekday", () => {
    // 02:00Z Saturday is still Friday 21:00 in NY: a weekday, but quiet hours.
    const r = rem({ cadence: "weekdays", time_of_day: "20:00" });
    expect(reminderDue({ reminder: r, timezone: NY, quiet: { quiet_start: "23:00", quiet_end: "06:00" }, now: new Date("2026-11-07T02:00:00Z") })).toBe("due");
  });
});

describe("missedDays", () => {
  it("counts days since the last done or partly check-in, not counting today", () => {
    expect(missedDays([], "2026-11-10")).toBe(0);
    expect(missedDays([{ day: "2026-11-09", status: "done" }], "2026-11-10")).toBe(0);
    expect(missedDays([{ day: "2026-11-05", status: "partly" }, { day: "2026-11-08", status: "missed" }], "2026-11-10")).toBe(4);
  });
});

describe("nextPlanItem", () => {
  const item = (title: string, due: string | null, extra: Partial<{ done: boolean; starts_at: string | null; sort: number; week: number }> = {}) =>
    ({ title, due_date: due, done: false, starts_at: null, sort: 0, week: 1, ...extra });
  it("prefers today's open item, then the next one, skipping done and past items", () => {
    const items = [item("past", "2026-11-01"), item("done today", "2026-11-10", { done: true }), item("tomorrow", "2026-11-11"), item("today", "2026-11-10", { sort: 2 })];
    expect(nextPlanItem(items, "2026-11-10", "UTC")?.title).toBe("today");
    expect(nextPlanItem([items[0], items[2]], "2026-11-10", "UTC")?.title).toBe("tomorrow");
    expect(nextPlanItem([items[0]], "2026-11-10", "UTC")).toBeNull();
  });
});

describe("weekly recap and partner nudges", () => {
  it("recap is due Sunday evening local time outside quiet hours", () => {
    expect(weeklyRecapDue(new Date("2026-11-08T23:00:00Z"), NY, quiet)).toBe(true); // Sun 18:00
    expect(weeklyRecapDue(new Date("2026-11-08T15:00:00Z"), NY, quiet)).toBe(false); // Sun 10:00
    expect(weeklyRecapDue(new Date("2026-11-09T03:00:00Z"), NY, quiet)).toBe(false); // Sun 22:00, quiet
    expect(weeklyRecapDue(new Date("2026-11-07T23:00:00Z"), NY, quiet)).toBe(false); // Saturday
  });
  it("flags a partner after 4+ quiet days", () => {
    expect(partnerWentQuiet("2026-11-07", "2026-11-10")).toBeNull();
    expect(partnerWentQuiet("2026-11-06", "2026-11-10")).toBe(4);
    expect(partnerWentQuiet(null, "2026-11-10")).toBeNull();
  });
});
