"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { effectivePlan, limits } from "@/lib/entitlements";
import { createAdminClient } from "@/lib/supabase/admin";
import { isInviteToken } from "@/lib/people/invites";
import { addMember } from "@/lib/people/server";
import type { PlanTier } from "@/lib/types";

export async function acceptInvite(token: string) {
  if (!isInviteToken(token)) redirect("/");
  const here = `/invite/${token}`;
  const { user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}`);

  const db = createAdminClient();
  const { data: invite } = await db.from("gk_invites").select("id, inviter_id, goal_id, circle_id, accepted_by").eq("token", token).maybeSingle();
  if (!invite) redirect(here);
  if (invite.accepted_by && invite.accepted_by !== user.id) redirect(`${here}?n=used`);
  if (invite.inviter_id === user.id) redirect(`${here}?n=own`);

  if (invite.goal_id) {
    const { data: goal } = await db.from("gk_goals").select("id, owner_id").eq("id", invite.goal_id).maybeSingle();
    if (!goal) redirect(`${here}?n=gone`);
    if (goal.owner_id !== user.id) {
      // Respect the owner's chosen-people limit (Free allows one).
      const [{ data: owner }, { data: viewers }] = await Promise.all([
        db.from("gk_profiles").select("plan, plan_until").eq("id", goal.owner_id).maybeSingle(),
        db.from("gk_goal_viewers").select("viewer_id").eq("goal_id", goal.id),
      ]);
      const plan = owner ? effectivePlan(owner as { plan: PlanTier; plan_until: string | null }) : "free";
      const list = (viewers ?? []).map((v) => v.viewer_id as string);
      if (!list.includes(user.id)) {
        if (list.length >= limits(plan).chosenPeople) redirect(`${here}?n=limit`);
        // The viewer row is recorded even if the goal is still Private; loadSharedGoal shows nothing until the owner widens it.
        const { error } = await db.from("gk_goal_viewers").insert({ goal_id: goal.id, viewer_id: user.id });
        if (error && error.code !== "23505") redirect(`${here}?n=failed`);
      }
    }
  } else if (invite.circle_id) {
    const { data: circle } = await db.from("gk_circles").select("id, max_members").eq("id", invite.circle_id).maybeSingle();
    if (!circle) redirect(`${here}?n=gone`);
    const result = await addMember(circle as { id: string; max_members: number }, user.id);
    if (result === "full") redirect(`${here}?n=full`);
    if (result === "missing") redirect(`${here}?n=failed`);
  }

  if (!invite.accepted_by) {
    await db.from("gk_invites").update({ accepted_by: user.id, accepted_at: new Date().toISOString() }).eq("id", invite.id).is("accepted_by", null);
  }
  revalidatePath("/app");
  if (invite.circle_id) redirect(`/app/circles/${invite.circle_id}?n=joined`);
  redirect(`${here}?n=accepted`);
}
