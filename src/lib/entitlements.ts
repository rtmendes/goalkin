// What each plan unlocks (PRD §4 Plans and pricing, owner decisions in docs/DECISIONS.md).
import type { PlanTier, Profile, Visibility } from "@/lib/types";

export const PLANS: { id: PlanTier; name: string; price: string; who: string; features: string[] }[] = [
  { id: "free", name: "Free", price: "$0", who: "One solo goal", features: ["One active goal", "Starter templates", "Private, plus one chosen person", "Email and push reminders", "Calendar feed"] },
  { id: "pro", name: "Pro", price: "$9/mo or $79/yr", who: "Unlimited goals", features: ["Unlimited goals", "All visibility levels", "AI plan builder", "Focus rooms", "Google Calendar two-way sync"] },
  { id: "circle", name: "Circle", price: "$29/mo", who: "A leader with up to 25 people", features: ["Everything in Pro", "Shared goals with member layers", "Circle meetups", "Up to 25 members"] },
  { id: "club", name: "Club", price: "$99/mo", who: "Up to 250 members", features: ["Everything in Circle", "Up to 250 members", "Branded page", "Sell your own templates"] },
];

const ORDER: PlanTier[] = ["free", "pro", "circle", "club"];

export function effectivePlan(p: Pick<Profile, "plan" | "plan_until">, now = new Date()): PlanTier {
  if (p.plan !== "free" && p.plan_until && new Date(p.plan_until) < now) return "free";
  return p.plan;
}
export const atLeast = (plan: PlanTier, min: PlanTier) => ORDER.indexOf(plan) >= ORDER.indexOf(min);

export function limits(plan: PlanTier) {
  return {
    activeGoals: plan === "free" ? 1 : Infinity,
    chosenPeople: plan === "free" ? 1 : Infinity,
    visibility: (plan === "free" ? ["private", "chosen"] : ["private", "chosen", "circle", "public"]) as Visibility[],
    aiPlanBuilder: plan !== "free",
    focusRooms: plan !== "free",
    googleSync: plan !== "free",
    circleMembers: plan === "club" ? 250 : plan === "circle" ? 25 : 8,
    leadCircles: atLeast(plan, "pro"),
    sellTemplates: plan === "club",
  };
}
