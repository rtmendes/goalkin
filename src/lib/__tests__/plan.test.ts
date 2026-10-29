import { describe, expect, it } from "vitest";
import { buildPlan, parseWeeks, requiredGuardrails, DOCTOR_STEP } from "@/lib/plan";
import bible from "../../../templates/full/bible-in-a-year.json";
import type { TemplateBody } from "@/lib/types";

describe("plan builder", () => {
  it("parses week ranges", () => {
    expect(parseWeeks("5-48")).toEqual([5, 48]);
    expect(parseWeeks("3")).toEqual([3, 3]);
  });
  it("health goals always get the doctor step, required", () => {
    expect(requiredGuardrails("Health", { guardrails: [] })).toContain(DOCTOR_STEP);
    const { items } = buildPlan({ template: null, title: "Lose weight", area: "Health", startDate: "2026-11-01" });
    const g = items.find((i) => i.kind === "guardrail")!;
    expect(g.required).toBe(true);
  });
  it("fits blueprint phases into the person's dates", () => {
    const { items, totalWeeks } = buildPlan({ template: bible as unknown as TemplateBody, title: "Bible", startDate: "2026-11-01", finishDate: "2026-12-31" });
    expect(totalWeeks).toBe(9);
    expect(Math.max(...items.map((i) => i.week))).toBeLessThanOrEqual(9);
    expect(items.some((i) => i.kind === "benchmark")).toBe(true);
  });
  it("low readiness shrinks week one and adds clear-the-path steps", () => {
    const { items, clearPath } = buildPlan({ template: null, title: "x", startDate: "2026-11-01", readiness: { time: 1, energy: 1, money: 1, support: 1, focus: 1 } });
    expect(clearPath.length).toBe(5);
    expect(items.some((i) => i.title.includes("starter size"))).toBe(true);
  });
});
