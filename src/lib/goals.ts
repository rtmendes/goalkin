import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { audienceFor, buildSharedView, DEFAULT_SUMMARY_VISIBILITY, type Audience, type SharedGoalView } from "@/lib/visibility";
import { computeProgress } from "@/lib/progress";
import type { CheckIn, Goal, GoalField, PlanItem, SummaryVisibility } from "@/lib/types";

export interface GoalBundle {
  goal: Goal;
  fields: GoalField[];
  summary: Omit<SummaryVisibility, "goal_id">;
  planItems: PlanItem[];
  checkIns: CheckIn[];
  progress: ReturnType<typeof computeProgress>;
}

/** Owner's full view, read through RLS (returns null if the caller is not the owner). */
export async function loadOwnGoal(goalId: string): Promise<GoalBundle | null> {
  const supabase = await createClient();
  const { data: goal } = await supabase.from("gk_goals").select("*").eq("id", goalId).maybeSingle();
  if (!goal) return null;
  const [fields, summary, plan, checks] = await Promise.all([
    supabase.from("gk_goal_fields").select("*").eq("goal_id", goalId).order("sort"),
    supabase.from("gk_goal_summary_visibility").select("*").eq("goal_id", goalId).maybeSingle(),
    supabase.from("gk_plan_items").select("*").eq("goal_id", goalId).order("week").order("sort"),
    supabase.from("gk_check_ins").select("*").eq("goal_id", goalId).order("day", { ascending: false }).limit(400),
  ]);
  const bundle = {
    goal: goal as Goal,
    fields: (fields.data ?? []) as GoalField[],
    summary: (summary.data ?? DEFAULT_SUMMARY_VISIBILITY) as Omit<SummaryVisibility, "goal_id">,
    planItems: (plan.data ?? []) as PlanItem[],
    checkIns: (checks.data ?? []) as CheckIn[],
  };
  return { ...bundle, progress: computeProgress({ goal: bundle.goal, checkIns: bundle.checkIns, planItems: bundle.planItems, fields: bundle.fields }) };
}

async function loadRaw(goal: Goal) {
  const db = createAdminClient();
  const [fields, summary, plan, checks] = await Promise.all([
    db.from("gk_goal_fields").select("*").eq("goal_id", goal.id),
    db.from("gk_goal_summary_visibility").select("*").eq("goal_id", goal.id).maybeSingle(),
    db.from("gk_plan_items").select("*").eq("goal_id", goal.id).order("week").order("sort"),
    db.from("gk_check_ins").select("*").eq("goal_id", goal.id).order("day", { ascending: false }).limit(400),
  ]);
  return {
    fields: (fields.data ?? []) as GoalField[],
    summary: (summary.data ?? null) as Omit<SummaryVisibility, "goal_id"> | null,
    planItems: (plan.data ?? []) as PlanItem[],
    checkIns: (checks.data ?? []) as CheckIn[],
  };
}

/**
 * What `viewerId` may see of someone else's goal. Uses the service role to read,
 * then filters through buildSharedView; never return raw rows from here.
 */
export async function loadSharedGoal(goalId: string, viewerId: string | null): Promise<SharedGoalView | null> {
  const db = createAdminClient();
  const { data: goal } = await db.from("gk_goals").select("*").eq("id", goalId).maybeSingle();
  if (!goal) return null;
  const audience = await audienceOf(goal as Goal, viewerId);
  if (audience === "none") return null;
  const raw = await loadRaw(goal as Goal);
  return buildSharedView({ goal: goal as Goal, ...raw, audience });
}

/** Public share page (no account needed). Only goals the owner set to Public have a token. */
export async function loadPublicGoal(token: string): Promise<SharedGoalView | null> {
  if (!/^[a-f0-9]{16,64}$/.test(token)) return null;
  const db = createAdminClient();
  const { data: goal } = await db.from("gk_goals").select("*").eq("share_token", token).eq("visibility", "public").maybeSingle();
  if (!goal) return null;
  const raw = await loadRaw(goal as Goal);
  return buildSharedView({ goal: goal as Goal, ...raw, audience: "public" });
}

export async function audienceOf(goal: Goal, viewerId: string | null): Promise<Audience> {
  if (!viewerId) return audienceFor({ goal, viewerId, isChosen: false, isCircleMember: false });
  if (viewerId === goal.owner_id) return "owner";
  const db = createAdminClient();
  const [chosen, member] = await Promise.all([
    db.from("gk_goal_viewers").select("viewer_id").eq("goal_id", goal.id).eq("viewer_id", viewerId).maybeSingle(),
    goal.circle_id
      ? db.from("gk_circle_members").select("user_id").eq("circle_id", goal.circle_id).eq("user_id", viewerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return audienceFor({ goal, viewerId, isChosen: !!chosen.data, isCircleMember: !!member.data });
}

/**
 * Preview exactly what a given ring would see, for the owner's share screen.
 * Uses the owner's own data, so it runs through RLS.
 */
export function previewFor(bundle: GoalBundle, audience: Exclude<Audience, "owner" | "none">) {
  // A preview ignores whether the goal card reaches this ring yet, so owners can see the effect before widening it.
  return buildSharedView({ goal: bundle.goal, fields: bundle.fields, summary: bundle.summary, checkIns: bundle.checkIns, planItems: bundle.planItems, audience });
}

/** Goals shared with the viewer (chosen people + circles), already filtered. */
export async function sharedWithMe(viewerId: string): Promise<{ owner: string; view: SharedGoalView }[]> {
  const db = createAdminClient();
  const [{ data: chosen }, { data: circles }] = await Promise.all([
    db.from("gk_goal_viewers").select("goal_id").eq("viewer_id", viewerId),
    db.from("gk_circle_members").select("circle_id").eq("user_id", viewerId),
  ]);
  const ids = new Set((chosen ?? []).map((c) => c.goal_id as string));
  const circleIds = (circles ?? []).map((c) => c.circle_id as string);
  if (circleIds.length) {
    const { data } = await db.from("gk_goals").select("id").in("circle_id", circleIds).in("visibility", ["circle", "public"]).neq("owner_id", viewerId);
    (data ?? []).forEach((g) => ids.add(g.id as string));
  }
  const out: { owner: string; view: SharedGoalView }[] = [];
  for (const id of ids) {
    const { data: g } = await db.from("gk_goals").select("owner_id").eq("id", id).maybeSingle();
    const view = await loadSharedGoal(id, viewerId);
    if (g && view) {
      const { data: p } = await db.from("gk_profiles").select("display_name").eq("id", g.owner_id).maybeSingle();
      out.push({ owner: (p?.display_name as string) ?? "Someone", view });
    }
  }
  return out;
}
