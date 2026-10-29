"use server";
import * as z from "zod/v4";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { effectivePlan, limits } from "@/lib/entitlements";
import { loadOwnGoal, previewFor } from "@/lib/goals";
import { env } from "@/lib/env";
import { clampRing, ringSchema, summarySchema } from "@/lib/goals-core/rules";
import { newShareToken } from "@/lib/goals-core/server";

const settingsSchema = z.object({
  goalId: z.uuid(),
  visibility: ringSchema,
  summary: summarySchema,
  fields: z.record(z.uuid(), ringSchema),
  publicLink: z.boolean(),
});

export type ShareResult = { ok: true; shareToken: string | null } | { ok: false; error: string };

export async function saveShareSettings(raw: unknown): Promise<ShareResult> {
  const { supabase, profile } = await requireUser();
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Those settings did not look right." };
  const p = parsed.data;
  const { data: goal } = await supabase.from("gk_goals").select("id, share_token").eq("id", p.goalId).maybeSingle();
  if (!goal) return { ok: false, error: "Goal not found." };
  const allowed = limits(effectivePlan(profile)).visibility;
  const clamp = (v: z.infer<typeof ringSchema>) => clampRing(v, allowed);
  const visibility = clamp(p.visibility);
  // A share token exists only while the goal is public and the owner wants a link.
  const shareToken = visibility === "public" && p.publicLink ? ((goal.share_token as string | null) ?? newShareToken()) : null;

  const summary = Object.fromEntries(Object.entries(p.summary).map(([k, v]) => [k, clamp(v)]));
  const [g, sv] = await Promise.all([
    supabase.from("gk_goals").update({ visibility, share_token: shareToken }).eq("id", p.goalId),
    supabase.from("gk_goal_summary_visibility").upsert({ goal_id: p.goalId, ...summary }, { onConflict: "goal_id" }),
    ...Object.entries(p.fields).map(([id, v]) => supabase.from("gk_goal_fields").update({ visibility: clamp(v) }).eq("id", id).eq("goal_id", p.goalId)),
  ]);
  if (g.error || sv.error) return { ok: false, error: "We couldn't save. Please try again." };
  revalidatePath(`/app/goals/${p.goalId}`);
  revalidatePath(`/app/goals/${p.goalId}/share`);
  return { ok: true, shareToken };
}

export type InviteResult = { ok: true; email: string; url: string } | { ok: false; error: string; upgrade?: boolean };

/** Chosen people are added by invite: they get a link and see the frozen preview until they accept. */
export async function inviteChosenPerson(goalId: string, email: string): Promise<InviteResult> {
  const { supabase, user, profile } = await requireUser();
  const parsed = z.object({ goalId: z.uuid(), email: z.email().max(200) }).safeParse({ goalId, email: email.trim().toLowerCase() });
  if (!parsed.success) return { ok: false, error: "That email doesn't look right." };
  const bundle = await loadOwnGoal(parsed.data.goalId);
  if (!bundle) return { ok: false, error: "Goal not found." };
  const max = limits(effectivePlan(profile)).chosenPeople;
  const [{ count: viewers }, { count: pending }] = await Promise.all([
    supabase.from("gk_goal_viewers").select("viewer_id", { count: "exact", head: true }).eq("goal_id", goalId),
    supabase.from("gk_invites").select("id", { count: "exact", head: true }).eq("goal_id", goalId).is("accepted_at", null),
  ]);
  if ((viewers ?? 0) + (pending ?? 0) >= max) {
    return { ok: false, upgrade: true, error: "The free plan includes one chosen person per goal." };
  }
  const { data, error } = await supabase
    .from("gk_invites")
    .insert({ inviter_id: user.id, email: parsed.data.email, goal_id: goalId, preview: previewFor(bundle, "chosen") ?? {} })
    .select("token")
    .single();
  if (error || !data) return { ok: false, error: "We couldn't create the invite." };
  revalidatePath(`/app/goals/${goalId}/share`);
  return { ok: true, email: parsed.data.email, url: `${env.appUrl}/invite/${data.token}` };
}

export async function removeViewer(fd: FormData) {
  const { supabase } = await requireUser();
  const ids = z.object({ goalId: z.uuid(), viewerId: z.uuid() }).safeParse({ goalId: fd.get("goalId"), viewerId: fd.get("viewerId") });
  if (!ids.success) return;
  await supabase.from("gk_goal_viewers").delete().eq("goal_id", ids.data.goalId).eq("viewer_id", ids.data.viewerId);
  revalidatePath(`/app/goals/${ids.data.goalId}/share`);
}

export async function revokeInvite(fd: FormData) {
  const { supabase } = await requireUser();
  const ids = z.object({ goalId: z.uuid(), inviteId: z.uuid() }).safeParse({ goalId: fd.get("goalId"), inviteId: fd.get("inviteId") });
  if (!ids.success) return;
  await supabase.from("gk_invites").delete().eq("id", ids.data.inviteId).eq("goal_id", ids.data.goalId).is("accepted_at", null);
  revalidatePath(`/app/goals/${ids.data.goalId}/share`);
}
