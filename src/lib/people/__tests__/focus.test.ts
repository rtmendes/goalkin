import { describe, expect, it } from "vitest";
import { clockOffset, focusPhase, focusTotalMs, formatClock, phaseLabel, spokenClock } from "@/lib/people/focus";

const start = "2026-10-29T10:00:00.000Z";
const at = (min: number, sec = 0) => new Date(start).getTime() + min * 60_000 + sec * 1000;
const room = { startedAt: start, workMin: 25, breakMin: 5, rounds: 4 };

describe("focusPhase", () => {
  it("waits until started", () => {
    expect(focusPhase({ ...room, startedAt: null, now: at(0) }).phase).toBe("waiting");
  });
  it("starts in focus, round 1", () => {
    const s = focusPhase({ ...room, now: at(0) });
    expect(s).toMatchObject({ phase: "focus", round: 1, remainingMs: 25 * 60_000 });
  });
  it("moves to a break after the work block", () => {
    const s = focusPhase({ ...room, now: at(25) });
    expect(s).toMatchObject({ phase: "break", round: 1, remainingMs: 5 * 60_000 });
  });
  it("counts rounds", () => {
    expect(focusPhase({ ...room, now: at(30) })).toMatchObject({ phase: "focus", round: 2 });
    expect(focusPhase({ ...room, now: at(84, 30) })).toMatchObject({ phase: "focus", round: 3, remainingMs: 30_000 });
  });
  it("has no break after the last round", () => {
    // 4 x 25 + 3 x 5 = 115 minutes
    expect(focusTotalMs(25, 5, 4)).toBe(115 * 60_000);
    expect(focusPhase({ ...room, now: at(114, 59) })).toMatchObject({ phase: "focus", round: 4, remainingMs: 1000 });
    expect(focusPhase({ ...room, now: at(115) })).toMatchObject({ phase: "done", remainingMs: 0 });
  });
  it("treats a clock slightly before the start as focus", () => {
    expect(focusPhase({ ...room, now: at(0, -3) })).toMatchObject({ phase: "focus", round: 1 });
  });
  it("handles a single round", () => {
    expect(focusPhase({ startedAt: start, workMin: 10, breakMin: 5, rounds: 1, now: at(10) }).phase).toBe("done");
  });
});

describe("clock helpers", () => {
  it("formats", () => {
    expect(formatClock(245_000)).toBe("4:05");
    expect(formatClock(3_723_000)).toBe("1:02:03");
    expect(formatClock(400)).toBe("0:01");
    expect(formatClock(-5)).toBe("0:00");
  });
  it("speaks", () => {
    expect(spokenClock(245_000)).toBe("4 minutes 5 seconds left");
    expect(spokenClock(60_000)).toBe("1 minute left");
    expect(spokenClock(0)).toBe("0 seconds left");
  });
  it("labels phases", () => {
    expect(phaseLabel({ phase: "break", round: 2, rounds: 4 })).toBe("Break, round 2 of 4");
  });
  it("computes clock offset from a round trip", () => {
    expect(clockOffset(10_500, 10_000, 10_200)).toBe(400);
  });
});
