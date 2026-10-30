import { describe, expect, it } from "vitest";
import bible from "../../../../templates/full/bible-in-a-year.json";
import { scanClaims, scanTemplateClaims, toKey, toTemplateId, validateTemplate } from "@/lib/marketplace/template-schema";
import { checkedInWeek4, experimentReport, isWeek4Eligible, salesTotals, week4Retention } from "@/lib/marketplace/metrics";
import { filterListings, formatPrice, readFilters } from "@/lib/marketplace/filters";
import { safeNext } from "@/lib/site/redirect";
import { autoChecks } from "@/lib/marketplace/review";
import type { TemplateBody } from "@/lib/types";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function healthTemplate(): TemplateBody {
  return {
    id: "walk-more-ab12", name: "Walk more", area: "Health", tier: "Creator", price: 9,
    summary: "Build up to a daily walk.", duration: "8 weeks",
    onboarding: [{ id: "minutes", prompt: "How many minutes a day?", type: "slider", min: 10, max: 60 }],
    plan_blueprint: { phases: [{ name: "Start", weeks: "1-8", actions: ["Walk"], benchmarks: ["Walk 5 days"] }] },
    tracked_fields: [{ id: "minutes", label: "Minutes walked", kind: "duration", unit: "min", default_visibility: "circle" }],
    guardrails: ["Talk to your doctor before starting a new exercise routine."],
  };
}

describe("template validation", () => {
  it("accepts the repo sample template", () => {
    const r = validateTemplate(bible);
    expect(r.errors).toEqual([]);
    expect(r.claims).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it("accepts a health template with a doctor step", () => {
    expect(validateTemplate(healthTemplate()).ok).toBe(true);
  });
  it("fails a health template without a doctor step", () => {
    const t = healthTemplate();
    t.guardrails = ["Go at your own pace."];
    const r = validateTemplate(t);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/doctor/);
  });
  it("needs the doctor step for diet templates outside Health too", () => {
    const t = healthTemplate();
    t.area = "Home and life";
    t.name = "Family diet reset";
    t.guardrails = [];
    expect(validateTemplate(t).ok).toBe(false);
  });
  it("forces health and money numbers to default private", () => {
    const t = healthTemplate();
    t.tracked_fields.push({ id: "weight", label: "Weight", kind: "number", unit: "lb", default_visibility: "circle" });
    expect(validateTemplate(t).errors.join(" ")).toMatch(/Weight.*Private/);
    const w = clone(bible) as unknown as TemplateBody;
    w.area = "Wealth";
    expect(validateTemplate(w).ok).toBe(false); // chapters/percent are circle; every Wealth number must start private
    const m = clone(bible) as unknown as TemplateBody;
    m.tracked_fields.push({ id: "gift", label: "Given", kind: "money", default_visibility: "public" });
    expect(validateTemplate(m).ok).toBe(false);
  });
  it("reports schema problems with a path", () => {
    const r = validateTemplate({ ...clone(bible), area: "Space", onboarding: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith("area"))).toBe(true);
    expect(r.errors.some((e) => e.startsWith("onboarding"))).toBe(true);
  });
  it("needs options on choice questions", () => {
    const t = healthTemplate();
    t.onboarding.push({ id: "pick", prompt: "Pick one", type: "choice", options: ["Only one"] });
    expect(validateTemplate(t).ok).toBe(false);
  });
});

describe("claim scan", () => {
  it.each([
    ["Guaranteed results in 30 days", "Guaranteed"],
    ["This plan will cure your back pain", "cure"],
    ["Lose 10 lbs in two weeks", "Lose 10 lbs in"],
    ["Get rich with side hustles", "Get rich"],
    ["Earn $500 a week from home", "Earn $500 a week"],
  ])("flags %s", (text, phrase) => {
    const hits = scanClaims(text);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].phrase.toLowerCase()).toBe(phrase.toLowerCase());
  });
  it("ignores negated and innocent wording", () => {
    expect(scanClaims("Results are not guaranteed; this is education.")).toEqual([]);
    expect(scanClaims("Keep your savings secure and lose 2 lbs over time if your doctor agrees")).toEqual([]);
    expect(scanClaims("Procure a notebook")).toEqual([]);
  });
  it("finds claims anywhere in a template and says where", () => {
    const t = healthTemplate();
    t.plan_blueprint.phases[0].actions = ["Walk", "Guaranteed to melt fat"];
    const hits = scanTemplateClaims(t);
    expect(hits[0].where).toBe("Phase 1 action");
    expect(validateTemplate(t).ok).toBe(false);
  });
});

describe("ids", () => {
  it("builds keys and template ids", () => {
    expect(toKey("Morning run length?", "q1")).toBe("morning_run_length");
    expect(toKey("???", "q1")).toBe("q1");
    expect(toTemplateId("First Marathon (Spring)!", "AB12")).toBe("first-marathon-spring-ab12");
  });
});

describe("week-4 check-in rate", () => {
  const now = new Date("2026-12-31T12:00:00Z");
  it("counts days 22-28 from the first goal (creation day is day 1)", () => {
    expect(checkedInWeek4("2026-11-01", ["2026-11-22"])).toBe(true); // day 22
    expect(checkedInWeek4("2026-11-01", ["2026-11-28"])).toBe(true); // day 28
    expect(checkedInWeek4("2026-11-01", ["2026-11-21", "2026-11-29"])).toBe(false); // days 21 and 29
  });
  it("only counts people whose 28 days have passed", () => {
    expect(isWeek4Eligible("2026-12-03", now)).toBe(true);
    expect(isWeek4Eligible("2026-12-04", now)).toBe(false);
  });
  it("computes the rate over eligible people using their first goal", () => {
    const goals = [
      { owner_id: "a", created_at: "2026-11-01T09:00:00Z", status: "active" },
      { owner_id: "a", created_at: "2026-11-20T09:00:00Z", status: "finished" },
      { owner_id: "b", created_at: "2026-11-01T09:00:00Z", status: "active" },
      { owner_id: "c", created_at: "2026-12-20T09:00:00Z", status: "active" }, // too new
    ];
    const checkIns = [
      { user_id: "a", day: "2026-11-25" },
      { user_id: "b", day: "2026-11-05" },
      { user_id: "c", day: "2026-12-21" },
    ];
    expect(week4Retention({ goals, checkIns, now })).toEqual({ eligible: 2, retained: 1, rate: 0.5 });
    expect(week4Retention({ goals: [], checkIns: [], now })).toEqual({ eligible: 0, retained: 0, rate: null });

    const report = experimentReport({
      experiments: [{ id: "first_week_size", name: "First-week size", active: true, variants: [{ key: "small" }, { key: "full" }] }],
      assignments: [
        { experiment_id: "first_week_size", user_id: "a", variant: "small" },
        { experiment_id: "first_week_size", user_id: "b", variant: "full" },
        { experiment_id: "first_week_size", user_id: "c", variant: "full" },
        { experiment_id: "other", user_id: "a", variant: "x" },
      ],
      goals, checkIns, now,
    });
    expect(report[0].variants).toEqual([
      { key: "small", assigned: 1, goalsFinished: 1, eligible: 1, retained: 1, rate: 1 },
      { key: "full", assigned: 2, goalsFinished: 0, eligible: 1, retained: 0, rate: 0 },
    ]);
  });
  it("totals sales", () => {
    expect(salesTotals([{ amount: "37.00", creator_share: "25.90" }, { amount: 9, creator_share: null }])).toEqual({ count: 2, gross: 46, creatorShare: 25.9 });
  });
});

describe("marketplace filters", () => {
  const items = [
    { name: "Bible in a Year", area: "Faith and spirit", tier: "Free", summary: "Daily readings" },
    { name: "Debt payoff", area: "Wealth", tier: "Premium", summary: "Payoff order and a money date" },
    { name: "First marathon", area: "Health", tier: "Creator", summary: "Long runs and taper" },
  ];
  it("filters by area, tier and words", () => {
    expect(filterListings(items, { area: "Wealth" }).map((i) => i.name)).toEqual(["Debt payoff"]);
    expect(filterListings(items, { tier: "Creator" }).map((i) => i.name)).toEqual(["First marathon"]);
    expect(filterListings(items, { q: "daily bible" }).map((i) => i.name)).toEqual(["Bible in a Year"]);
    expect(filterListings(items, {}).length).toBe(3);
  });
  it("reads search params and formats prices", () => {
    expect(readFilters({ area: ["Health", "x"], tier: "", q: "  run " })).toEqual({ area: "Health", tier: undefined, q: "run" });
    expect(formatPrice("Free", 0)).toBe("Free");
    expect(formatPrice("Premium", 37)).toBe("$37");
    expect(formatPrice("Premium", 9.5)).toBe("$9.50");
    expect(formatPrice("Creator", 0)).toBe("Set by creator");
  });
});

describe("safe redirects", () => {
  it("allows relative paths only", () => {
    expect(safeNext("/onboarding?template=x")).toBe("/onboarding?template=x");
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("/\\evil.com")).toBe("/app");
    expect(safeNext("https://evil.com")).toBe("/app");
    expect(safeNext(null, "/")).toBe("/");
  });
});

describe("review auto-checks", () => {
  it("passes the repo sample and runs three sample people", () => {
    const r = autoChecks(bible, "2026-11-02");
    expect(r.schema.ok && r.claims.ok && r.doctorStep.ok && r.visibility.ok).toBe(true);
    expect(r.planTest.samples).toHaveLength(3);
    expect(r.planTest.samples.map((s) => s.totalWeeks)).toEqual([12, 6, 52]);
    expect(r.planTest.ok).toBe(true);
  });
  it("fails a health template without a doctor step", () => {
    const t = healthTemplate();
    t.guardrails = [];
    expect(autoChecks(t, "2026-11-02").doctorStep).toEqual({ ok: false, needed: true });
  });
});
