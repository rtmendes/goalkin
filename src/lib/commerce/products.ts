// Product keys used in gk_purchases.product, the GoHighLevel names that map to
// them, and what each one unlocks. Pure: safe to import anywhere and unit-test.
import type { PlanTier } from "@/lib/types";

export type PlanProduct = "pro_monthly" | "pro_yearly" | "circle" | "club";
export type ProductKey = PlanProduct | `program:${string}` | `template:${string}`;

export const PLAN_PRODUCTS: Record<PlanProduct, { plan: PlanTier; months: number; checkoutKey: string; label: string }> = {
  pro_monthly: { plan: "pro", months: 1, checkoutKey: "pro_monthly", label: "Pro, monthly" },
  pro_yearly: { plan: "pro", months: 12, checkoutKey: "pro_yearly", label: "Pro, yearly" },
  circle: { plan: "circle", months: 1, checkoutKey: "circle", label: "Circle, monthly" },
  club: { plan: "club", months: 1, checkoutKey: "club", label: "Club, monthly" },
};

/** Seasonal programs: template id -> checkout env key (serverEnv().checkout). */
export const PROGRAMS: Record<string, { checkoutKey: string; name: string; price: number; window: string; summary: string }> = {
  "finish-the-year": {
    checkoutKey: "finish_the_year",
    name: "Finish the Year",
    price: 37,
    window: "Nov 20 to Dec 31",
    summary: "Pick one goal you can still finish this year. Weekly benchmarks, a partner check-in and a finish certificate.",
  },
  "new-year-reset": {
    checkoutKey: "new_year_reset",
    name: "New Year Reset",
    price: 37,
    window: "Jan 1 to 31",
    summary: "Turn a resolution into a 31-day plan with your circle. Built for the week-two slump.",
  },
};

const ID = /^[a-z0-9-]+$/;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Names as they may appear in GoHighLevel product / price fields (normalized).
const NAME_TABLE: [RegExp, ProductKey][] = [
  [/\bpro\b.*\b(year|yearly|annual|annually)\b|\b(year|yearly|annual)\b.*\bpro\b/, "pro_yearly"],
  [/\bpro\b/, "pro_monthly"],
  [/\bcircle\b/, "circle"],
  [/\bclub\b/, "club"],
  [/\bfinish (the )?year\b|\bfinish 20\d\d\b/, "program:finish-the-year"],
  [/\bnew year reset\b|\bnew year\b/, "program:new-year-reset"],
];

/**
 * Map a raw product reference to a product key. Accepts the keys themselves
 * ("pro_yearly", "template:debt-payoff", "program:finish-the-year") or a GHL
 * product/price name ("GoalKin Pro - Annual", "Finish the Year Program").
 */
export function mapProduct(raw: string | null | undefined): ProductKey | null {
  if (!raw) return null;
  const s = raw.trim();
  const lower = s.toLowerCase().replace(/^(template|program)\s*:\s*/, "$1:");
  if (lower in PLAN_PRODUCTS) return lower as PlanProduct;
  const m = lower.match(/^(template|program):([a-z0-9-]+)$/);
  if (m) return `${m[1] as "template" | "program"}:${m[2]}`;
  if (/^(template|program):/.test(lower)) return null; // a key with a malformed id
  const n = norm(s);
  // "Template: debt-payoff" or "template debt payoff" style names.
  const t = n.match(/^template (.+)$/);
  if (t) {
    const id = t[1].replace(/ /g, "-");
    if (ID.test(id)) return `template:${id}`;
  }
  // Programs first: "New Year Reset" must not match the generic plan words below.
  for (const [re, key] of NAME_TABLE.filter(([, k]) => k.startsWith("program:"))) if (re.test(n)) return key;
  for (const [re, key] of NAME_TABLE.filter(([, k]) => !k.startsWith("program:"))) if (re.test(n)) return key;
  return null;
}

export function isPlanProduct(p: string): p is PlanProduct {
  return p in PLAN_PRODUCTS;
}

/** The gk_templates id a template/program purchase unlocks, if any. */
export function templateIdFor(product: string): string | null {
  const m = product.match(/^(?:template|program):([a-z0-9-]+)$/);
  return m ? m[1] : null;
}

const RANK: PlanTier[] = ["free", "pro", "circle", "club"];

/**
 * New plan state after buying a plan product. Time stacks on an active plan of
 * the same tier; a purchase never downgrades an active higher tier (it is only
 * recorded); an upgrade starts now.
 */
export function nextPlanState(
  current: { plan: PlanTier; plan_until: string | null } | null,
  product: PlanProduct,
  now = new Date(),
): { plan: PlanTier; plan_until: string } | null {
  const p = PLAN_PRODUCTS[product];
  const until = current?.plan_until ? new Date(current.plan_until) : null;
  const active = !!current && current.plan !== "free" && (!until || until > now);
  if (active && RANK.indexOf(current!.plan) > RANK.indexOf(p.plan)) return null;
  const base = active && current!.plan === p.plan && until && until > now ? until : now;
  const next = new Date(base);
  next.setUTCMonth(next.getUTCMonth() + p.months);
  return { plan: p.plan, plan_until: next.toISOString() };
}

/** Creator's cut of a sale, rounded to cents. */
export function creatorShare(amount: number | null | undefined, revenueShare: number | null | undefined): number | null {
  if (amount == null || revenueShare == null || !Number.isFinite(amount)) return null;
  return Math.round(amount * revenueShare * 100) / 100;
}
