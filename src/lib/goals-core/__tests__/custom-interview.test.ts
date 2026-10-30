import { describe, expect, it } from "vitest";
import { bodyFromCustomPlan, CUSTOM_QUESTIONS } from "@/lib/goals-core/custom-interview";
import { buildPlan } from "@/lib/plan";

describe("custom interview", () => {
  it("asks between 10 and 20 questions", () => {
    expect(CUSTOM_QUESTIONS.length).toBeGreaterThanOrEqual(10);
    expect(CUSTOM_QUESTIONS.length).toBeLessThanOrEqual(20);
  });

  it("turns an edited plan into a template the plan builder can reuse", () => {
    const body = bodyFromCustomPlan({
      id: "custom-walk-abc123", name: "Walk more", area: "Health", summary: "Walking plan",
      items: [
        { week: 1, title: "Talk to your doctor before starting.", kind: "guardrail" },
        { week: 1, title: "Walk 10 minutes", kind: "session" },
        { week: 2, title: "Walk 15 minutes", kind: "session" },
        { week: 2, title: "Walked 4 days", kind: "benchmark" },
        { week: 2, title: "Weekly check-in", kind: "checkin" },
      ],
    });
    expect(body.tier).toBe("Custom");
    expect(body.guardrails).toEqual(["Talk to your doctor before starting."]);
    expect(body.plan_blueprint.phases).toEqual([
      { name: "Week 1", weeks: "1-1", actions: ["Walk 10 minutes"], benchmarks: [] },
      { name: "Week 2", weeks: "2-2", actions: ["Walk 15 minutes"], benchmarks: ["Walked 4 days"] },
    ]);
    const plan = buildPlan({ template: body, title: "Walk more", area: "Health", startDate: "2026-11-02" });
    expect(plan.totalWeeks).toBe(2);
    expect(plan.items.filter((i) => i.required)).toHaveLength(1);
  });
});
