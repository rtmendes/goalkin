import "server-only";
// Scheduled jobs behind /api/cron/reminders: daily reminders, Sunday recaps and
// partner-went-quiet nudges. Service role is used because no one is signed in;
// anything about another person goes through loadSharedGoal (visibility gate).
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { loadSharedGoal } from "@/lib/goals";
import { computeProgress, streakWithRecovery } from "@/lib/progress";
import { reminderText } from "@/lib/tone";
import type { CheckIn, Goal, GoalField, PlanItem, Profile, Tone } from "@/lib/types";
import { dailyReminderEmail, partnerQuietEmail, sendEmail, weeklyRecapEmail } from "@/lib/integrations/email";
import { checkinUrl } from "@/lib/integrations/links";
import { sendPushToUser } from "@/lib/integrations/push";
import { inQuietHours, missedDays, nextPlanItem, partnerWentQuiet, recapKey, reminderDue, weeklyRecapDue, type ReminderRow } from "@/lib/integrations/reminders";
import { localDay, localParts, safeZone, shiftDay } from "@/lib/integrations/time";

type P = Pick<Profile, "id" | "display_name" | "timezone" | "quiet_start" | "quiet_end" | "default_tone">;

function emailLookup(db: SupabaseClient) {
  const cache = new Map<string, string | null>();
  return async (userId: string) => {
    if (!cache.has(userId)) {
      const { data } = await db.auth.admin.getUserById(userId);
      cache.set(userId, data.user?.email ?? null);
    }
    return cache.get(userId)!;
  };
}

async function logEvent(db: SupabaseClient, userId: string, name: string, props: Record<string, unknown>) {
  await db.from("gk_events").insert({ user_id: userId, name, props });
}

async function alreadyLogged(db: SupabaseClient, userId: string, name: string, match: Record<string, string>) {
  let q = db.from("gk_events").select("id").eq("user_id", userId).eq("name", name);
  for (const [k, v] of Object.entries(match)) q = q.eq(`props->>${k}`, v);
  const { data } = await q.limit(1);
  return !!data?.length;
}

async function loadProfiles(db: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Map<string, P>();
  const { data } = await db.from("gk_profiles").select("id,display_name,timezone,quiet_start,quiet_end,default_tone").in("id", ids);
  return new Map(((data ?? []) as P[]).map((p) => [p.id, { ...p, timezone: safeZone(p.timezone) }]));
}

export async function runReminderJobs(now = new Date(), budgetMs = 50_000) {
  const started = Date.now();
  const outOfTime = () => Date.now() - started > budgetMs;
  const db = createAdminClient();
  const emailOf = emailLookup(db);
  const stats = { checked: 0, sent: 0, failed: 0, recaps: 0, nudges: 0 };

  const { data: remRows } = await db.from("gk_reminders").select("*").eq("active", true).in("channel", ["email", "push"]).limit(5000);
  const reminders = (remRows ?? []) as ReminderRow[];
  const goalIds = [...new Set(reminders.map((r) => r.goal_id))];
  const { data: goalRows } = goalIds.length ? await db.from("gk_goals").select("id,owner_id,title,tone,status").in("id", goalIds).eq("status", "active") : { data: [] };
  const goals = new Map(((goalRows ?? []) as Pick<Goal, "id" | "owner_id" | "title" | "tone" | "status">[]).map((g) => [g.id, g]));
  const profiles = await loadProfiles(db, [...new Set(reminders.map((r) => r.user_id))]);

  // --- Daily / weekday / weekly reminders ---
  const ctxCache = new Map<string, { items: PlanItem[]; checkIns: CheckIn[] }>();
  const goalCtx = async (goalId: string, since: string) => {
    if (!ctxCache.has(goalId)) {
      const [items, checks] = await Promise.all([
        db.from("gk_plan_items").select("*").eq("goal_id", goalId).eq("done", false).limit(500),
        db.from("gk_check_ins").select("day,status").eq("goal_id", goalId).gte("day", since).order("day", { ascending: false }),
      ]);
      ctxCache.set(goalId, { items: (items.data ?? []) as PlanItem[], checkIns: (checks.data ?? []) as CheckIn[] });
    }
    return ctxCache.get(goalId)!;
  };

  for (const r of reminders) {
    if (outOfTime()) break;
    const goal = goals.get(r.goal_id);
    const profile = profiles.get(r.user_id);
    if (!goal || !profile || goal.owner_id !== r.user_id) continue;
    stats.checked++;
    if (reminderDue({ reminder: r, timezone: profile.timezone, quiet: profile, now }) !== "due") continue;

    const today = localDay(now, profile.timezone);
    const { items, checkIns } = await goalCtx(goal.id, shiftDay(today, -90));
    const next = nextPlanItem(items, today, profile.timezone);
    const missed = missedDays(checkIns, today);
    const streak = streakWithRecovery(checkIns, new Date(today + "T12:00:00Z"));
    const ctx = { name: profile.display_name, goal: goal.title, action: next?.title, streak, missedDays: missed >= 2 ? missed : undefined };
    const links = {
      done: checkinUrl(goal.id, r.user_id, today, "done"),
      partly: checkinUrl(goal.id, r.user_id, today, "partly"),
      missed: checkinUrl(goal.id, r.user_id, today, "missed"),
    };

    let ok = false;
    try {
      if (r.channel === "email") {
        const to = await emailOf(r.user_id);
        if (to) {
          const res = await sendEmail({ to, ...dailyReminderEmail({ tone: goal.tone as Tone, ...ctx, links }) });
          ok = res.ok || "skipped" in res;
        }
      } else {
        const { subject, body } = reminderText(goal.tone as Tone, ctx);
        await sendPushToUser(db, r.user_id, { title: subject, body, url: `${env.appUrl}/app/goals/${goal.id}`, checkinUrl: links.done, tag: `gk-${goal.id}` });
        ok = true;
      }
    } catch (e) {
      console.warn("[reminders] send failed", (e as Error).message);
    }
    if (ok) {
      stats.sent++;
      await db.from("gk_reminders").update({ last_sent_at: now.toISOString() }).eq("id", r.id);
      await logEvent(db, r.user_id, "reminder_sent", { channel: r.channel, goal_id: goal.id });
    } else stats.failed++;
  }

  // --- Sunday recaps, through the channels each person already turned on ---
  const channelsByUser = new Map<string, Set<string>>();
  for (const r of reminders) {
    if (!goals.has(r.goal_id)) continue;
    if (!channelsByUser.has(r.user_id)) channelsByUser.set(r.user_id, new Set());
    channelsByUser.get(r.user_id)!.add(r.channel);
  }
  for (const [userId, channels] of channelsByUser) {
    if (outOfTime()) break;
    const p = profiles.get(userId);
    if (!p || !weeklyRecapDue(now, p.timezone, p)) continue;
    const week = recapKey(now, p.timezone);
    if (await alreadyLogged(db, userId, "weekly_recap_sent", { week })) continue;
    const recap = await weeklyRecap(db, userId, now, p.timezone);
    if (!recap.length) continue;
    const tone = p.default_tone;
    if (channels.has("email")) {
      const to = await emailOf(userId);
      if (to) await sendEmail({ to, ...weeklyRecapEmail({ tone, name: p.display_name, goals: recap }) }).catch(() => null);
    }
    if (channels.has("push")) {
      const done = recap.reduce((s, g) => s + g.done, 0);
      await sendPushToUser(db, userId, { title: "Your week in review", body: `${done} check-in${done === 1 ? "" : "s"} done this week. Tap to plan next week.`, url: `${env.appUrl}/app`, tag: "gk-recap" }).catch(() => null);
    }
    await logEvent(db, userId, "weekly_recap_sent", { week });
    stats.recaps++;
  }

  if (!outOfTime()) stats.nudges = await partnerNudges(db, now, emailOf, outOfTime);
  return stats;
}

async function weeklyRecap(db: SupabaseClient, userId: string, now: Date, tz: string) {
  const today = localDay(now, tz);
  const weekAgo = shiftDay(today, -6);
  const { data: goalRows } = await db.from("gk_goals").select("*").eq("owner_id", userId).eq("status", "active");
  const out: { title: string; done: number; planned: number; percent: number; streak: number }[] = [];
  for (const goal of (goalRows ?? []) as Goal[]) {
    const [fields, items, checks] = await Promise.all([
      db.from("gk_goal_fields").select("*").eq("goal_id", goal.id),
      db.from("gk_plan_items").select("*").eq("goal_id", goal.id).limit(2000),
      db.from("gk_check_ins").select("*").eq("goal_id", goal.id).order("day", { ascending: false }).limit(400),
    ]);
    const planItems = (items.data ?? []) as PlanItem[];
    const checkIns = (checks.data ?? []) as CheckIn[];
    const progress = computeProgress({ goal, checkIns, planItems, fields: (fields.data ?? []) as GoalField[], today: new Date(today + "T12:00:00Z") });
    const done = checkIns.filter((c) => c.day >= weekAgo && c.day <= today && c.status !== "missed").length;
    const planned = Math.max(done, planItems.filter((i) => i.kind !== "guardrail" && i.due_date && i.due_date >= weekAgo && i.due_date <= today).length);
    out.push({ title: goal.title, done, planned, percent: progress.percent, streak: progress.streak });
  }
  return out;
}

/**
 * Tell circle leaders when a member's circle-visible goal has had no check-in
 * for 4+ days. The gap is read from the leader's shared view, so a member who
 * keeps check-ins private never triggers a nudge.
 */
async function partnerNudges(db: SupabaseClient, now: Date, emailOf: (id: string) => Promise<string | null>, outOfTime: () => boolean) {
  const [{ data: leaders }, { data: owners }] = await Promise.all([
    db.from("gk_circle_members").select("circle_id,user_id").eq("role", "leader").limit(2000),
    db.from("gk_circles").select("id,owner_id").limit(2000),
  ]);
  const leadersByCircle = new Map<string, Set<string>>();
  const add = (c: string, u: string) => {
    if (!leadersByCircle.has(c)) leadersByCircle.set(c, new Set());
    leadersByCircle.get(c)!.add(u);
  };
  (leaders ?? []).forEach((l) => add(l.circle_id as string, l.user_id as string));
  (owners ?? []).forEach((c) => add(c.id as string, c.owner_id as string));
  if (!leadersByCircle.size) return 0;

  const { data: goalRows } = await db.from("gk_goals").select("id,owner_id,circle_id").in("circle_id", [...leadersByCircle.keys()]).eq("status", "active").in("visibility", ["circle", "public"]).limit(1000);
  const memberGoals = (goalRows ?? []) as Pick<Goal, "id" | "owner_id" | "circle_id">[];
  const allLeaders = [...new Set([...leadersByCircle.values()].flatMap((s) => [...s]))];
  const profiles = await loadProfiles(db, [...new Set([...allLeaders, ...memberGoals.map((g) => g.owner_id)])]);
  const { data: emailRems } = await db.from("gk_reminders").select("user_id").in("user_id", allLeaders).eq("channel", "email").eq("active", true);
  const emailOptIn = new Set((emailRems ?? []).map((r) => r.user_id as string));

  let sent = 0;
  for (const g of memberGoals) {
    for (const leaderId of leadersByCircle.get(g.circle_id!) ?? []) {
      if (outOfTime()) return sent;
      if (leaderId === g.owner_id) continue;
      const leader = profiles.get(leaderId);
      if (!leader) continue;
      const local = localParts(now, leader.timezone);
      // Daytime only, and never in the leader's quiet hours.
      if (local.minutes < 9 * 60 || local.minutes >= 20 * 60 || inQuietHours(local.minutes, leader)) continue;
      const view = await loadSharedGoal(g.id, leaderId);
      const last = view?.recent?.[0]?.day ?? null;
      const gap = view ? partnerWentQuiet(last, local.date) : null;
      if (!view || !gap || !last) continue;
      if (await alreadyLogged(db, leaderId, "partner_quiet_nudge", { goal_id: g.id, last })) continue;

      const partner = profiles.get(g.owner_id)?.display_name ?? "Someone in your circle";
      const circleUrl = `${env.appUrl}/app/circles/${g.circle_id}`;
      await sendPushToUser(db, leaderId, { title: `${partner} could use a nudge`, body: `No check-in on "${view.title}" for ${gap} days. A kind note helps.`, url: circleUrl, tag: `gk-quiet-${g.id}` }).catch(() => null);
      if (emailOptIn.has(leaderId)) {
        const to = await emailOf(leaderId);
        if (to) await sendEmail({ to, ...partnerQuietEmail({ partner, goal: view.title, days: gap, circleUrl }) }).catch(() => null);
      }
      await logEvent(db, leaderId, "partner_quiet_nudge", { goal_id: g.id, last });
      sent++;
    }
  }
  return sent;
}
