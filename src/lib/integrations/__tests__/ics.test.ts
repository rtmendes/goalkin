import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, foldLine, formatDate, formatUtc } from "@/lib/integrations/ics";
import { planItemToIcs, weeklyCheckinEvents, type CalItem } from "@/lib/integrations/calendar-items";

const NOW = new Date("2026-10-29T12:34:56Z");
const bytes = (s: string) => new TextEncoder().encode(s).length;

describe("escapeText", () => {
  it("escapes backslash, semicolon, comma and newlines", () => {
    expect(escapeText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });
  it("escapes backslash first so other escapes are not doubled", () => {
    expect(escapeText(";")).toBe("\\;");
    expect(escapeText("\\;")).toBe("\\\\\\;");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:hi")).toBe("SUMMARY:hi");
  });
  it("folds at 75 octets with CRLF + space", () => {
    const line = "DESCRIPTION:" + "x".repeat(200);
    const folded = foldLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(2);
    for (const p of parts) expect(bytes(p)).toBeLessThanOrEqual(75);
    for (const p of parts.slice(1)) expect(p.startsWith(" ")).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
  });
  it("never splits a multi-byte character", () => {
    const line = "SUMMARY:" + "é✓🏃".repeat(40);
    const parts = foldLine(line).split("\r\n");
    for (const p of parts) {
      expect(bytes(p)).toBeLessThanOrEqual(75);
      expect(p).not.toContain("�");
    }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
  });
});

describe("formatting", () => {
  it("formats UTC date-times and dates", () => {
    expect(formatUtc(NOW)).toBe("20261029T123456Z");
    expect(formatDate("2026-11-01")).toBe("20261101");
    expect(() => formatDate("11/01/2026")).toThrow();
  });
});

describe("buildCalendar", () => {
  const cal = buildCalendar({
    name: "GoalKin goals",
    now: NOW,
    events: [
      { uid: "a@goalkin.app", summary: "Run, easy; 20 min", start: { date: "2026-11-01" }, description: "Line 1\nLine 2" },
      { uid: "b@goalkin.app", summary: "Session", start: { dateTime: new Date("2026-11-02T14:00:00Z") }, durationMin: 45 },
    ],
  });

  it("uses CRLF everywhere and ends with CRLF", () => {
    expect(cal.endsWith("\r\n")).toBe(true);
    expect(cal.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
  it("wraps events in a VCALENDAR with required properties", () => {
    expect(cal.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:")).toBe(true);
    expect(cal).toContain("END:VCALENDAR");
    expect(cal.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(cal.match(/DTSTAMP:20261029T123456Z/g)).toHaveLength(2);
  });
  it("writes all-day events as VALUE=DATE with an exclusive end", () => {
    expect(cal).toContain("DTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261102");
  });
  it("writes timed events in UTC without TZID", () => {
    expect(cal).toContain("DTSTART:20261102T140000Z\r\nDTEND:20261102T144500Z");
    expect(cal).not.toContain("TZID");
  });
  it("escapes text values", () => {
    expect(cal).toContain("SUMMARY:Run\\, easy\\; 20 min");
    expect(cal).toContain("DESCRIPTION:Line 1\\nLine 2");
  });
  it("defaults timed events to 30 minutes", () => {
    const c = buildCalendar({ name: "x", now: NOW, events: [{ uid: "c", summary: "s", start: { dateTime: new Date("2026-11-02T23:45:00Z") } }] });
    expect(c).toContain("DTEND:20261103T001500Z");
  });
  it("writes a DATE-typed UNTIL for all-day weekly series", () => {
    const c = buildCalendar({ name: "x", now: NOW, events: [{ uid: "d", summary: "s", start: { date: "2026-11-01" }, weeklyUntil: "2026-12-31" }] });
    expect(c).toContain("RRULE:FREQ=WEEKLY;UNTIL=20261231");
  });
});

describe("plan items to ICS", () => {
  const goal = { id: "g1", title: "First 5K", start_date: "2026-10-01", finish_date: "2026-12-01" };
  const base: CalItem = { id: "i1", goal_id: "g1", title: "Easy run", notes: null, kind: "session", due_date: "2026-11-01", starts_at: null, duration_min: null, done: false, required: false };

  it("keeps a stable UID per item and puts the check-in link in the description", () => {
    const ev = planItemToIcs(base, goal, { tz: "UTC", checkinLink: "https://x/api/checkin?t=1", appUrl: "https://x" })!;
    expect(ev.uid).toBe("item-i1@goalkin.app");
    expect(ev.description).toContain("https://x/api/checkin?t=1");
    expect(ev.start).toEqual({ date: "2026-11-01" });
  });
  it("uses starts_at when present and skips undated items", () => {
    const timed = planItemToIcs({ ...base, starts_at: "2026-11-01T13:00:00Z", duration_min: 20 }, goal, { tz: "UTC", checkinLink: "l", appUrl: "a" })!;
    expect("dateTime" in timed.start).toBe(true);
    expect(planItemToIcs({ ...base, due_date: null }, goal, { tz: "UTC", checkinLink: "l", appUrl: "a" })).toBeNull();
  });
  it("marks done items", () => {
    expect(planItemToIcs({ ...base, done: true }, goal, { tz: "UTC", checkinLink: "l", appUrl: "a" })!.summary.startsWith("✓ ")).toBe(true);
  });
  it("builds one weekly check-in per week inside the window, each with its own day link", () => {
    const evs = weeklyCheckinEvents(goal, { from: "2026-10-20", to: "2026-11-30" }, { appUrl: "a", linkFor: (d) => `link-${d}` });
    expect(evs.map((e) => (e.start as { date: string }).date)).toEqual(["2026-10-21", "2026-10-28", "2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25"]);
    expect(evs[0].description).toContain("link-2026-10-21");
    expect(new Set(evs.map((e) => e.uid)).size).toBe(evs.length);
  });
  it("stops weekly check-ins at the finish date", () => {
    const evs = weeklyCheckinEvents({ ...goal, finish_date: "2026-10-30" }, { from: "2026-10-01", to: "2027-01-01" }, { appUrl: "a", linkFor: () => "l" });
    expect(evs.map((e) => (e.start as { date: string }).date)).toEqual(["2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"]);
  });
});
