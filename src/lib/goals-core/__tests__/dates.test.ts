import { describe, expect, it } from "vitest";
import { addDays, greeting, missedDays, primaryField, todayIn, weekOf, weeklySeries } from "@/lib/goals-core/dates";

describe("dates", () => {
  it("adds days and computes weeks", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(weekOf("2026-10-01", "2026-10-01")).toBe(1);
    expect(weekOf("2026-10-01", "2026-10-08")).toBe(2);
  });
  it("reads today in a time zone", () => {
    const now = new Date("2026-10-30T02:00:00Z");
    expect(todayIn("America/New_York", now)).toBe("2026-10-29");
    expect(todayIn("Not/AZone", now)).toBe("2026-10-30");
  });
});

describe("missedDays", () => {
  const start = "2026-10-20";
  it("counts the gap since the last good day", () => {
    expect(missedDays([{ day: "2026-10-25", status: "done" }], start, "2026-10-29")).toBe(3);
    expect(missedDays([{ day: "2026-10-28", status: "partly" }], start, "2026-10-29")).toBe(0);
  });
  it("treats missed check-ins as missed and stops at the start date", () => {
    expect(missedDays([{ day: "2026-10-28", status: "missed" }], "2026-10-27", "2026-10-29")).toBe(2);
    expect(missedDays([], "2026-10-29", "2026-10-29")).toBe(0);
  });
});

describe("weeklySeries", () => {
  it("totals the primary field per week and tracks benchmarks", () => {
    const fields = [{ key: "note", kind: "note" as const, target: null }, { key: "miles", kind: "number" as const, target: 50 }];
    const field = primaryField(fields);
    expect(field?.key).toBe("miles");
    const s = weeklySeries({
      startDate: "2026-10-01", today: "2026-10-10", field,
      checkIns: [
        { day: "2026-10-02", status: "done", values: { miles: 3 } },
        { day: "2026-10-03", status: "done", values: { miles: 4 } },
        { day: "2026-10-09", status: "partly", values: { miles: 2 } },
      ],
      planItems: [{ week: 1, kind: "benchmark", done: true }, { week: 2, kind: "benchmark", done: false }],
    });
    expect(s).toEqual([
      { week: 1, value: 7, benchmarks: 1, benchmarksDone: 1 },
      { week: 2, value: 2, benchmarks: 1, benchmarksDone: 0 },
    ]);
  });
  it("counts good days when there is no number", () => {
    const s = weeklySeries({ startDate: "2026-10-01", today: "2026-10-03", field: null, planItems: [],
      checkIns: [{ day: "2026-10-01", status: "done", values: {} }, { day: "2026-10-02", status: "missed", values: {} }] });
    expect(s[0].value).toBe(1);
  });
});

describe("greeting", () => {
  it("follows the tone", () => {
    expect(greeting("drill", "Sam", 9)).toContain("Get moving");
    expect(greeting("coach", null, 20)).toContain("evening");
  });
});
