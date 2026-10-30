import { describe, expect, it } from "vitest";
import { eventDiffers, eventToItemUpdate, googleEditedSince, itemToEvent } from "@/lib/integrations/gcal-map";
import type { CalItem } from "@/lib/integrations/calendar-items";

const goal = { id: "g1", title: "Read the Bible in a year", start_date: "2026-10-01", finish_date: null };
const item: CalItem = { id: "i1", goal_id: "g1", title: "Read 3 chapters", notes: "Phase 1", kind: "session", due_date: "2026-11-03", starts_at: null, duration_min: null, done: false, required: false };
const opts = { tz: "America/Chicago", checkinLink: "https://app/api/checkin?g=g1&t=x", appUrl: "https://app" };

describe("itemToEvent", () => {
  it("maps a dated item to an all-day event with an exclusive end", () => {
    const ev = itemToEvent(item, goal, opts)!;
    expect(ev.start).toEqual({ date: "2026-11-03" });
    expect(ev.end).toEqual({ date: "2026-11-04" });
    expect(ev.transparency).toBe("transparent");
    expect(ev.extendedProperties?.private).toEqual({ gkItemId: "i1", gkGoalId: "g1" });
    expect(ev.summary).toBe("Read 3 chapters · Read the Bible in a year");
    expect(ev.description).toContain(opts.checkinLink);
    expect(ev.colorId).toBeUndefined();
  });
  it("maps a timed item with duration and time zone", () => {
    const ev = itemToEvent({ ...item, starts_at: "2026-11-03T12:00:00.000Z", duration_min: 45 }, goal, opts)!;
    expect(ev.start).toEqual({ dateTime: "2026-11-03T12:00:00.000Z", timeZone: "America/Chicago" });
    expect(ev.end).toEqual({ dateTime: "2026-11-03T12:45:00.000Z", timeZone: "America/Chicago" });
    expect(ev.transparency).toBe("opaque");
  });
  it("colours done items and skips undated ones", () => {
    expect(itemToEvent({ ...item, done: true }, goal, opts)!.colorId).toBe("2");
    expect(itemToEvent({ ...item, due_date: null }, goal, opts)).toBeNull();
  });
});

describe("eventDiffers", () => {
  it("is false for an identical event, regardless of dateTime formatting", () => {
    const desired = itemToEvent({ ...item, starts_at: "2026-11-03T12:00:00.000Z" }, goal, opts)!;
    const existing = { ...desired, id: "e1", start: { dateTime: "2026-11-03T06:00:00-06:00" }, end: { dateTime: "2026-11-03T06:30:00-06:00" } };
    expect(eventDiffers(desired, existing)).toBe(false);
  });
  it("is true when the title, time or colour changed", () => {
    const desired = itemToEvent(item, goal, opts)!;
    expect(eventDiffers(desired, { ...desired, summary: "old" })).toBe(true);
    expect(eventDiffers(desired, { ...desired, start: { date: "2026-11-04" } })).toBe(true);
    expect(eventDiffers({ ...desired, colorId: "2" }, desired)).toBe(true);
  });
});

describe("eventToItemUpdate (two-way)", () => {
  it("pulls a moved timed event back onto the item, with local due date and duration", () => {
    const upd = eventToItemUpdate(
      { start: { dateTime: "2026-11-05T23:30:00-06:00" }, end: { dateTime: "2026-11-06T00:30:00-06:00" } },
      { ...item, starts_at: "2026-11-03T12:00:00Z", duration_min: 30 },
      "America/Chicago",
    );
    expect(upd).toEqual({ starts_at: "2026-11-06T05:30:00.000Z", due_date: "2026-11-05", duration_min: 60 });
  });
  it("turns a timed item into an all-day one when moved to a date", () => {
    expect(eventToItemUpdate({ start: { date: "2026-11-07" } }, { ...item, starts_at: "2026-11-03T12:00:00Z" }, "UTC")).toEqual({ starts_at: null, due_date: "2026-11-07", duration_min: null });
  });
  it("returns null when nothing moved", () => {
    expect(eventToItemUpdate({ start: { date: "2026-11-03" } }, item, "UTC")).toBeNull();
    expect(eventToItemUpdate(
      { start: { dateTime: "2026-11-03T12:00:00Z" }, end: { dateTime: "2026-11-03T12:30:00Z" } },
      { ...item, starts_at: "2026-11-03T12:00:00.000Z", duration_min: null },
      "UTC",
    )).toBeNull();
  });
});

describe("googleEditedSince", () => {
  it("only trusts Google's time when the event changed after our last sync", () => {
    expect(googleEditedSince({ updated: "2026-11-03T10:00:00Z" }, "2026-11-03T09:00:00Z")).toBe(true);
    expect(googleEditedSince({ updated: "2026-11-03T08:00:00Z" }, "2026-11-03T09:00:00Z")).toBe(false);
    expect(googleEditedSince({ updated: "2026-11-03T10:00:00Z" }, null)).toBe(false);
  });
});
