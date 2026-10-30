import { describe, expect, it } from "vitest";
import { clampRing, minutesFromSlots, onboardingSchema, ownsMediaPath } from "@/lib/goals-core/rules";

describe("clampRing", () => {
  const free = ["private", "chosen"] as const;
  it("keeps allowed rings and narrows the rest", () => {
    expect(clampRing("chosen", [...free])).toBe("chosen");
    expect(clampRing("public", [...free])).toBe("chosen");
    expect(clampRing("circle", ["private"])).toBe("private");
  });
});

describe("ownsMediaPath", () => {
  it("only accepts the person's own folder", () => {
    expect(ownsMediaPath("u1/why/memo.m4a", "u1", "why")).toBe(true);
    expect(ownsMediaPath("u2/why/memo.m4a", "u1", "why")).toBe(false);
    expect(ownsMediaPath("u1/why/../../u2/x", "u1", "why")).toBe(false);
    expect(ownsMediaPath("u1/checkins/a.jpg", "u1", "why")).toBe(false);
  });
});

describe("onboardingSchema", () => {
  const base = {
    area: "Health", templateId: null, title: "Walk every day", finishDate: null, why: null, whyMediaPath: null, starter: null,
    summary: { status: "private", percent: "private", streak: "private", plan: "private", why: "private", check_in_notes: "private", photos: "private" },
  };
  it("defaults to private and simple tracking", () => {
    const p = onboardingSchema.parse(base);
    expect(p.visibility).toBe("private");
    expect(p.trackingMode).toBe("simple");
    expect(p.invites).toEqual([]);
  });
  it("rejects bad slots and emails", () => {
    expect(onboardingSchema.safeParse({ ...base, slots: ["noon"] }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...base, invites: ["not-an-email"] }).success).toBe(false);
  });
  it("estimates minutes from slots", () => {
    expect(minutesFromSlots(["mon-morning", "tue-evening"])).toBe(60);
    expect(minutesFromSlots([])).toBeNull();
  });
});
