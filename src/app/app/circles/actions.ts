"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { requireUser } from "@/lib/auth";
import { loadSharedGoal } from "@/lib/goals";
import { createAdminClient } from "@/lib/supabase/admin";
import { RINGS } from "@/lib/visibility";
import { circleInvitePreview, reactionBody, voicePathOwner } from "@/lib/people/invites";
import { detachGoals, loadCircleAdmin, namesFor, planLimits, roleIn } from "@/lib/people/server";
import { localToUtc } from "@/lib/people/time";
import type { NoticeCode } from "@/lib/people/notices";
import type { Goal, Visibility } from "@/lib/types";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : undefined;
};

function back(circleId: string, code: NoticeCode, hash = ""): never {
  revalidatePath(`/app/circles/${circleId}`);
  redirect(`/app/circles/${circleId}?n=${code}${hash ? `#${hash}` : ""}`);
}

/** Signed-in person who is in the circle (leader or member); otherwise bounce. */
async function memberCtx(circleId: string) {
  if (!uuid.safeParse(circleId).success) redirect("/app/circles");
  const ctx = await requireUser(`/app/circles/${circleId}`);
  const [role, circle] = await Promise.all([roleIn(circleId, ctx.user.id), loadCircleAdmin(circleId)]);
  if (!circle) redirect("/app/circles");
  const isOwner = circle.owner_id === ctx.user.id;
  if (!role && !isOwner) redirect("/app/circles?n=not_member");
  return { ...ctx, circle, isOwner };
}

async function leaderCtx(circleId: string) {
  const ctx = await memberCtx(circleId);
  if (!ctx.isOwner) back(circleId, "not_member");
  return ctx;
}

// Circles ----------------------------------------------------------------------

const createSchema = z.object({
  name: text(80),
  description: optText(500),
  kind: z.enum(["pair", "group", "club"]),
  tone: z.enum(["gentle", "coach", "drill", "playful"]),
  program: optText(2000),
});

export async function createCircle(fd: FormData) {
  const { supabase, user, profile } = await requireUser("/app/circles");
  const lim = planLimits(profile);
  if (!lim.leadCircles) redirect("/app/circles?n=need_plan");
  const parsed = createSchema.safeParse({
    name: str(fd, "name"),
    description: str(fd, "description"),
    kind: str(fd, "kind"),
    tone: str(fd, "tone"),
    program: str(fd, "program"),
  });
  if (!parsed.success) redirect("/app/circles?n=invalid");
  const v = parsed.data;
  const { data: circle, error } = await supabase
    .from("gk_circles")
    .insert({ owner_id: user.id, ...v, max_members: v.kind === "pair" ? 2 : lim.circleMembers })
    .select("id")
    .single();
  if (error || !circle) redirect("/app/circles?n=failed");
  // RLS has no member insert policy on purpose; ownership was just proven by the insert above.
  const { error: memberErr } = await createAdminClient()
    .from("gk_circle_members")
    .insert({ circle_id: circle.id, user_id: user.id, role: "leader" });
  if (memberErr) {
    await supabase.from("gk_circles").delete().eq("id", circle.id);
    redirect("/app/circles?n=failed");
  }
  revalidatePath("/app/circles");
  redirect(`/app/circles/${circle.id}?n=created`);
}

export async function regenerateInviteCode(circleId: string) {
  const { supabase } = await leaderCtx(circleId);
  const { error } = await supabase.from("gk_circles").update({ invite_code: randomBytes(9).toString("hex") }).eq("id", circleId);
  back(circleId, error ? "failed" : "regenerated", "invite");
}

export async function inviteByEmail(circleId: string, fd: FormData) {
  const { supabase, user, circle } = await memberCtx(circleId);
  const email = z.email().max(254).safeParse(str(fd, "email")?.trim().toLowerCase());
  if (!email.success) back(circleId, "invalid", "invite");
  const leader = (await namesFor([circle.owner_id])).get(circle.owner_id) ?? "The leader";
  const { error } = await supabase.from("gk_invites").insert({
    inviter_id: user.id,
    email: email.data,
    circle_id: circleId,
    preview: circleInvitePreview({ circleName: circle.name, leaderName: leader }),
  });
  back(circleId, error ? "failed" : "invited", "invite");
}

export async function leaveCircle(circleId: string) {
  const { supabase, user, isOwner } = await memberCtx(circleId);
  if (isOwner) back(circleId, "leader_stays");
  const { error } = await supabase.from("gk_circle_members").delete().eq("circle_id", circleId).eq("user_id", user.id);
  if (error) back(circleId, "failed");
  await detachGoals(circleId, user.id);
  revalidatePath("/app/circles");
  redirect("/app/circles?n=left");
}

export async function removeMember(circleId: string, fd: FormData) {
  const { supabase, circle } = await leaderCtx(circleId);
  const who = uuid.safeParse(str(fd, "user_id"));
  if (!who.success || who.data === circle.owner_id) back(circleId, "invalid", "members");
  const { error } = await supabase.from("gk_circle_members").delete().eq("circle_id", circleId).eq("user_id", who.data);
  if (error) back(circleId, "failed", "members");
  await detachGoals(circleId, who.data);
  back(circleId, "removed", "members");
}

export async function deleteCircle(circleId: string, fd: FormData) {
  const { supabase } = await leaderCtx(circleId);
  if (str(fd, "confirm") !== "yes") back(circleId, "invalid", "danger");
  const { error } = await supabase.from("gk_circles").delete().eq("id", circleId);
  if (error) back(circleId, "failed", "danger");
  revalidatePath("/app/circles");
  redirect("/app/circles?n=deleted");
}

// Shared goal and member layers ------------------------------------------------------

export async function createSharedGoal(circleId: string, fd: FormData) {
  const { supabase, user, circle } = await leaderCtx(circleId);
  const parsed = z
    .object({ title: text(140), finish_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)) })
    .safeParse({ title: str(fd, "title"), finish_date: str(fd, "finish_date") ?? "" });
  if (!parsed.success) back(circleId, "invalid", "shared");
  const { data: goal, error } = await supabase
    .from("gk_goals")
    .insert({
      owner_id: user.id,
      title: parsed.data.title,
      finish_date: parsed.data.finish_date ?? null,
      circle_id: circleId,
      visibility: "circle",
      tone: circle.tone,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !goal) back(circleId, "failed", "shared");
  await supabase.from("gk_circles").update({ shared_goal_id: goal.id }).eq("id", circleId);
  revalidatePath(`/app/circles/${circleId}`);
  redirect(`/app/goals/${goal.id}/share`);
}

export async function attachSharedGoal(circleId: string, fd: FormData) {
  const { supabase, user } = await leaderCtx(circleId);
  const goalId = uuid.safeParse(str(fd, "goal_id"));
  if (!goalId.success) back(circleId, "invalid", "shared");
  const { data: goal } = await supabase.from("gk_goals").select("id, owner_id, visibility, parent_goal_id").eq("id", goalId.data).maybeSingle();
  const g = goal as Pick<Goal, "id" | "owner_id" | "visibility" | "parent_goal_id"> | null;
  if (!g || g.owner_id !== user.id || g.parent_goal_id) back(circleId, "invalid", "shared");
  // The card must reach the circle for members to see the shared goal at all; never narrow a wider choice.
  const visibility: Visibility = RINGS.indexOf(g.visibility) >= RINGS.indexOf("circle") ? g.visibility : "circle";
  const { error } = await supabase.from("gk_goals").update({ circle_id: circleId, visibility }).eq("id", g.id);
  if (error) back(circleId, "failed", "shared");
  await supabase.from("gk_circles").update({ shared_goal_id: g.id }).eq("id", circleId);
  revalidatePath(`/app/circles/${circleId}`);
  redirect(`/app/goals/${g.id}/share`);
}

export async function addMyLayer(circleId: string, fd: FormData) {
  const { supabase, user, circle } = await memberCtx(circleId);
  if (!circle.shared_goal_id) back(circleId, "invalid", "shared");
  const { data: existing } = await supabase
    .from("gk_goals")
    .select("id")
    .eq("owner_id", user.id)
    .eq("parent_goal_id", circle.shared_goal_id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    // Re-attach a layer kept from an earlier membership instead of making a duplicate.
    await supabase.from("gk_goals").update({ circle_id: circleId }).eq("id", existing.id);
    redirect(`/app/goals/${existing.id}/share`);
  }
  const title = text(140).safeParse(str(fd, "title"));
  if (!title.success) back(circleId, "invalid", "shared");
  const { data: goal, error } = await supabase
    .from("gk_goals")
    .insert({
      owner_id: user.id,
      title: title.data,
      parent_goal_id: circle.shared_goal_id,
      circle_id: circleId,
      visibility: "private",
      tone: circle.tone,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !goal) back(circleId, "failed", "shared");
  revalidatePath(`/app/circles/${circleId}`);
  redirect(`/app/goals/${goal.id}/share`);
}

/** A partner dare on another member's goal, allowed only when that goal is visible to the proposer. */
export async function proposeDare(circleId: string, fd: FormData) {
  const { user } = await memberCtx(circleId);
  const parsed = z
    .object({ goal_id: uuid, description: text(200), trigger_rule: optText(200) })
    .safeParse({ goal_id: str(fd, "goal_id"), description: str(fd, "description"), trigger_rule: str(fd, "trigger_rule") });
  if (!parsed.success) back(circleId, "invalid", "shared");
  const db = createAdminClient();
  const { data: goal } = await db.from("gk_goals").select("owner_id, circle_id").eq("id", parsed.data.goal_id).maybeSingle();
  if (!goal || goal.circle_id !== circleId || goal.owner_id === user.id) back(circleId, "not_visible", "shared");
  if (!(await roleIn(circleId, goal.owner_id as string))) back(circleId, "not_visible", "shared");
  const view = await loadSharedGoal(parsed.data.goal_id, user.id);
  if (!view) back(circleId, "not_visible", "shared");
  const { error } = await db.from("gk_consequences").insert({
    goal_id: parsed.data.goal_id,
    set_by: user.id,
    kind: "partner_dare",
    description: parsed.data.description,
    trigger_rule: parsed.data.trigger_rule,
    accepted: false,
  });
  back(circleId, error ? "failed" : "dare", "shared");
}

// Encouragement ------------------------------------------------------------------------

async function recipient(circleId: string, raw: string | undefined): Promise<string | null | "bad"> {
  if (!raw) return null;
  const id = uuid.safeParse(raw);
  if (!id.success) return "bad";
  return (await roleIn(circleId, id.data)) ? id.data : "bad";
}

export async function sendNote(circleId: string, fd: FormData) {
  const { supabase, user } = await memberCtx(circleId);
  const body = text(500).safeParse(str(fd, "body"));
  const to = await recipient(circleId, str(fd, "to_id"));
  if (!body.success || to === "bad") back(circleId, "invalid", "encourage");
  const { error } = await supabase.from("gk_encouragements").insert({ circle_id: circleId, from_id: user.id, to_id: to, kind: "note", body: body.data });
  back(circleId, error ? "failed" : "sent", "feed");
}

export async function sendReaction(circleId: string, fd: FormData) {
  const { supabase, user } = await memberCtx(circleId);
  const body = reactionBody(Number(str(fd, "reaction")));
  const to = await recipient(circleId, str(fd, "to_id"));
  if (!body || to === "bad") back(circleId, "invalid", "encourage");
  const { error } = await supabase.from("gk_encouragements").insert({ circle_id: circleId, from_id: user.id, to_id: to, kind: "reaction", body });
  back(circleId, error ? "failed" : "sent", "feed");
}

export async function sendVoiceNote(circleId: string, fd: FormData) {
  const { supabase, user } = await memberCtx(circleId);
  const path = str(fd, "path") ?? "";
  if (voicePathOwner(path) !== user.id) back(circleId, "invalid", "encourage");
  const { error } = await supabase.from("gk_encouragements").insert({ circle_id: circleId, from_id: user.id, kind: "voice", media_url: path });
  back(circleId, error ? "failed" : "sent", "feed");
}

// Meetups ------------------------------------------------------------------------------

export async function createMeetup(circleId: string, fd: FormData) {
  const { supabase, user, profile } = await memberCtx(circleId);
  const parsed = z
    .object({
      title: text(120),
      starts_local: z.string(),
      duration_min: z.coerce.number().int().min(5).max(480),
      link: z.url({ protocol: /^https?$/ }).max(500).optional().or(z.literal("").transform(() => undefined)),
    })
    .safeParse({ title: str(fd, "title"), starts_local: str(fd, "starts_at"), duration_min: str(fd, "duration_min"), link: str(fd, "link") ?? "" });
  const startsAt = parsed.success ? localToUtc(parsed.data.starts_local, profile.timezone) : null;
  if (!parsed.success || !startsAt) back(circleId, "invalid", "meetups");
  const { error } = await supabase.from("gk_meetups").insert({
    circle_id: circleId,
    title: parsed.data.title,
    starts_at: startsAt.toISOString(),
    duration_min: parsed.data.duration_min,
    link: parsed.data.link ?? null,
    created_by: user.id,
  });
  back(circleId, error ? "failed" : "meetup", "meetups");
}

export async function deleteMeetup(circleId: string, fd: FormData) {
  const { user, isOwner } = await memberCtx(circleId);
  const id = uuid.safeParse(str(fd, "meetup_id"));
  if (!id.success) back(circleId, "invalid", "meetups");
  const db = createAdminClient();
  const { data: m } = await db.from("gk_meetups").select("created_by, circle_id").eq("id", id.data).maybeSingle();
  // No delete policy in RLS: only the creator or the leader may remove a meetup.
  if (!m || m.circle_id !== circleId || (m.created_by !== user.id && !isOwner)) back(circleId, "not_member", "meetups");
  const { error } = await db.from("gk_meetups").delete().eq("id", id.data);
  back(circleId, error ? "failed" : "meetup_removed", "meetups");
}
