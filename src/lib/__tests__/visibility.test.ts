import { describe, expect, it } from "vitest";
import { audienceFor, buildSharedView, canSee } from "@/lib/visibility";
import type { CheckIn, Goal, GoalField } from "@/lib/types";

const goal = {
  id: "g1", owner_id: "owner", title: "Run a half", why: "For my kids", why_media_url: null, area: "Health",
  template_id: null, start_date: "2026-10-01", finish_date: "2026-12-31", tracking_mode: "detailed", tone: "coach",
  approach: null, answers: {}, readiness: {}, if_then: [], restart_rule: null, status: "active",
  visibility: "circle", circle_id: "c1", parent_goal_id: null, share_token: null, finished_at: null, created_at: "",
} as Goal;
const fields: GoalField[] = [
  { id: "f1", goal_id: "g1", key: "miles", label: "Miles", kind: "number", unit: "mi", target: 100, visibility: "circle", sort: 0 },
  { id: "f2", goal_id: "g1", key: "weight", label: "Weight", kind: "number", unit: "lb", target: null, visibility: "private", sort: 1 },
];
const checkIns = [
  { id: "1", goal_id: "g1", user_id: "owner", day: "2026-10-28", status: "done", rating: null, note: "felt great", photo_url: null, values: { miles: 5, weight: 180 }, created_at: "" },
] as CheckIn[];

describe("canSee", () => {
  it("private is owner-only", () => {
    expect(canSee("private", "chosen")).toBe(false);
    expect(canSee("private", "owner")).toBe(true);
  });
  it("wider ring includes narrower audiences", () => {
    expect(canSee("circle", "chosen")).toBe(true);
    expect(canSee("circle", "circle")).toBe(true);
    expect(canSee("circle", "public")).toBe(false);
    expect(canSee("public", "public")).toBe(true);
  });
});

describe("audienceFor", () => {
  it("strangers see nothing unless the goal is public", () => {
    expect(audienceFor({ goal, viewerId: "x", isChosen: false, isCircleMember: false })).toBe("none");
    expect(audienceFor({ goal: { ...goal, visibility: "public" }, viewerId: null, isChosen: false, isCircleMember: false })).toBe("public");
  });
  it("private goals hide from everyone but the owner", () => {
    const g = { ...goal, visibility: "private" as const };
    expect(audienceFor({ goal: g, viewerId: "x", isChosen: true, isCircleMember: true })).toBe("none");
    expect(audienceFor({ goal: g, viewerId: "owner", isChosen: false, isCircleMember: false })).toBe("owner");
  });
  it("chosen-only goal hides from circle members", () => {
    const g = { ...goal, visibility: "chosen" as const };
    expect(audienceFor({ goal: g, viewerId: "m", isChosen: false, isCircleMember: true })).toBe("none");
    expect(audienceFor({ goal: g, viewerId: "m", isChosen: true, isCircleMember: true })).toBe("chosen");
  });
});

describe("buildSharedView", () => {
  it("defaults keep every summary value private", () => {
    const v = buildSharedView({ goal, fields, summary: null, checkIns, planItems: [], audience: "circle", today: new Date("2026-10-29") })!;
    expect(v.percent).toBeUndefined();
    expect(v.why).toBeUndefined();
    expect(v.fields.map((f) => f.key)).toEqual(["miles"]);
    expect(JSON.stringify(v)).not.toContain("180");
    expect(JSON.stringify(v)).not.toContain("felt great");
    expect(v.hidden_count).toBeGreaterThan(0);
  });
  it("shows on-track and % to a circle while hiding the numbers behind it", () => {
    const summary = { status: "circle", percent: "circle", streak: "private", plan: "private", why: "private", check_in_notes: "private", photos: "private" } as const;
    const v = buildSharedView({ goal, fields: fields.map((f) => ({ ...f, visibility: "private" })), summary, checkIns, planItems: [], audience: "circle", today: new Date("2026-10-29") })!;
    expect(v.status).toBeDefined();
    expect(v.percent).toBe(5);
    expect(v.fields).toEqual([]);
  });
  it("returns null for no audience", () => {
    expect(buildSharedView({ goal, fields, summary: null, checkIns, planItems: [], audience: "none" })).toBeNull();
  });
});
