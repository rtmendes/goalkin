import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan, limits } from "@/lib/entitlements";
import type { Circle, Profile } from "@/lib/types";

export type Role = "leader" | "member";

export interface Member {
  user_id: string;
  role: Role;
  joined_at: string;
  name: string;
}

/** Display names for a set of people. Only call with ids the viewer is allowed to know (fellow members). */
export async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  try {
    const { data } = await createAdminClient().from("gk_profiles").select("id, display_name").in("id", unique);
    for (const p of data ?? []) map.set(p.id as string, (p.display_name as string | null) || "A GoalKin member");
  } catch {
    /* names are cosmetic; fall back below */
  }
  for (const id of unique) if (!map.has(id)) map.set(id, "A GoalKin member");
  return map;
}

/** The viewer's role in a circle, or null if they are not in it. Reads with the service role. */
export async function roleIn(circleId: string, userId: string): Promise<Role | null> {
  const { data } = await createAdminClient()
    .from("gk_circle_members")
    .select("role")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as Role | undefined) ?? null;
}

export async function loadCircleAdmin(circleId: string): Promise<Circle | null> {
  const { data } = await createAdminClient().from("gk_circles").select("*").eq("id", circleId).maybeSingle();
  return (data as Circle | null) ?? null;
}

export async function membersOf(circleId: string): Promise<Member[]> {
  const { data } = await createAdminClient()
    .from("gk_circle_members")
    .select("user_id, role, joined_at")
    .eq("circle_id", circleId)
    .order("joined_at");
  const rows = (data ?? []) as Omit<Member, "name">[];
  const names = await namesFor(rows.map((r) => r.user_id));
  return rows
    .map((r) => ({ ...r, name: names.get(r.user_id) ?? "A GoalKin member" }))
    .sort((a, b) => (a.role === b.role ? 0 : a.role === "leader" ? -1 : 1));
}

export async function memberCount(circleId: string): Promise<number> {
  const { count } = await createAdminClient()
    .from("gk_circle_members")
    .select("user_id", { count: "exact", head: true })
    .eq("circle_id", circleId);
  return count ?? 0;
}

export type JoinResult = "joined" | "already" | "full" | "missing";

/**
 * Add someone to a circle with the service role (RLS has no member insert policy on
 * purpose). Checks the seat limit first.
 */
export async function addMember(circle: Pick<Circle, "id" | "max_members">, userId: string): Promise<JoinResult> {
  const db = createAdminClient();
  const existing = await roleIn(circle.id, userId);
  if (existing) return "already";
  const count = await memberCount(circle.id);
  if (count >= circle.max_members) return "full";
  const { error } = await db.from("gk_circle_members").insert({ circle_id: circle.id, user_id: userId, role: "member" });
  if (error) return error.code === "23505" ? "already" : "missing";
  return "joined";
}

/**
 * When someone leaves (or is removed), their goals stop being shared with the circle.
 * parent_goal_id is kept so the layer can be re-attached if they rejoin.
 */
export async function detachGoals(circleId: string, userId: string) {
  await createAdminClient().from("gk_goals").update({ circle_id: null }).eq("circle_id", circleId).eq("owner_id", userId);
}

export function planLimits(profile: Pick<Profile, "plan" | "plan_until">) {
  return limits(effectivePlan(profile));
}
