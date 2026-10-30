import { describe, expect, it } from "vitest";
import { computeProgress, streakWithRecovery } from "@/lib/progress";

const ci = (day: string, status: "done" | "partly" | "missed") => ({ day, status, values: {} });

describe("streakWithRecovery", () => {
  it("counts consecutive days", () => {
    expect(streakWithRecovery([ci("2026-10-27", "done"), ci("2026-10-28", "done")], new Date("2026-10-28T12:00:00Z"))).toBe(2);
  });
  it("does not break when today is not checked in yet", () => {
    expect(streakWithRecovery([ci("2026-10-27", "done")], new Date("2026-10-28T12:00:00Z"))).toBe(1);
  });
  it("forgives a single missed day", () => {
    const days = [ci("2026-10-24", "done"), ci("2026-10-25", "done"), ci("2026-10-26", "missed"), ci("2026-10-27", "done"), ci("2026-10-28", "done")];
    expect(streakWithRecovery(days, new Date("2026-10-28T12:00:00Z"))).toBe(4);
  });
  it("two missed days in a row end the streak", () => {
    const days = [ci("2026-10-23", "done"), ci("2026-10-25", "missed"), ci("2026-10-26", "missed"), ci("2026-10-27", "done")];
    expect(streakWithRecovery(days, new Date("2026-10-27T12:00:00Z"))).toBe(1);
  });
});

describe("computeProgress", () => {
  it("uses plan items when there is no numeric target", () => {
    const p = computeProgress({
      goal: { start_date: "2026-10-01", finish_date: "2026-10-31", status: "active" },
      checkIns: [],
      planItems: [{ done: true, kind: "action", due_date: null }, { done: false, kind: "action", due_date: null }, { done: false, kind: "guardrail", due_date: null }],
      fields: [],
      today: new Date("2026-10-15T00:00:00Z"),
    });
    expect(p.percent).toBe(50);
    expect(p.status).toBe("on_track");
  });
});
