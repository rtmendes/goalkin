import { describe, expect, it } from "vitest";
import { bodyFromCatalog, fieldsFromTemplate, guessQuestionType, isSensitiveField, visibilityFor } from "@/lib/goals-core/template-shape";

describe("visibilityFor", () => {
  it("matches the label to a catalog code", () => {
    expect(visibilityFor("Weekly miles", "Miles Ci; weight P")).toBe("circle");
    expect(visibilityFor("Weight", "Miles Ci; weight P")).toBe("private");
    expect(visibilityFor("Distance", "Distance Ci; pace P")).toBe("circle");
    expect(visibilityFor("Sessions", "All C")).toBe("chosen");
    expect(visibilityFor("Anything", "nonsense")).toBe("private");
  });
});

describe("safe defaults", () => {
  it("flags health, money and weight numbers", () => {
    expect(isSensitiveField({ label: "Weigh-ins (optional)", kind: "number" })).toBe(true);
    expect(isSensitiveField({ label: "Debt paid", kind: "number" })).toBe(true);
    expect(isSensitiveField({ label: "Raised", kind: "money" })).toBe(true);
    expect(isSensitiveField({ label: "Chapters read", kind: "number" })).toBe(false);
  });
  it("forces sensitive fields private even if the template shares them", () => {
    const fields = fieldsFromTemplate({
      tracked_fields: [
        { id: "weight", label: "Weight", kind: "number", default_visibility: "public" },
        { id: "miles", label: "Miles", kind: "number", default_visibility: "circle" },
        { id: "miles", label: "Miles again", kind: "number", default_visibility: "circle" },
      ],
    });
    expect(fields.map((f) => f.visibility)).toEqual(["private", "circle", "circle"]);
    expect(new Set(fields.map((f) => f.key)).size).toBe(3);
  });
});

describe("bodyFromCatalog", () => {
  it("creates questions and tracked fields from a catalog row", () => {
    const b = bodyFromCatalog({
      id: "first-5k-10k", area: "Health", name: "First 5K", tier: "Free", ai_builds: "Walk-run plan",
      onboarding_inputs: ['Race date or "no race yet"', "runs per week now", "days free"],
      tracks: ["Runs done", "distance"], default_visibility: "Distance Ci; pace P",
    });
    expect(b.onboarding.map((q) => q.type)).toEqual(["date", "number", "calendar_slots"]);
    expect(b.onboarding.every((q) => q.optional)).toBe(true);
    expect(b.tracked_fields.find((f) => f.label === "Distance")?.default_visibility).toBe("circle");
    expect(b.tracked_fields.find((f) => f.label === "Runs done")?.default_visibility).toBe("private");
  });
  it("guesses question types", () => {
    expect(guessQuestionType("Target amount")).toBe("number");
    expect(guessQuestionType("Who you want to call")).toBe("text");
  });
});
