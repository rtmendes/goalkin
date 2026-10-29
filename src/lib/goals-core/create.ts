import "server-only";
import { draftPlan, type PlanResult } from "@/lib/ai";
import { buildPlan } from "@/lib/plan";
import { scoreApproach } from "@/lib/approach";
import { effectivePlan, limits } from "@/lib/entitlements";
import { track, variantFor } from "@/lib/experiments";
import { TONES } from "@/lib/tone";
import { buildSharedView, DEFAULT_SUMMARY_VISIBILITY } from "@/lib/visibility";
import { env } from "@/lib/env";
import type { createClient } from "@/lib/supabase/server";
import type { Goal, GoalField, PlanItem, Profile, SummaryVisibility, TemplateBody, Tone, TrackingMode, Visibility } from "@/lib/types";
import { clampRing, minutesFromSlots } from "@/lib/goals-core/rules";
import { fieldsFromTemplate } from "@/lib/goals-core/template-shape";
import { todayIn } from "@/lib/goals-core/dates";
import { templateRowExists } from "@/lib/goals-core/server";

type Db = Awaited<ReturnType<typeof createClient>>;

export interface CreateGoalInput {
  title: string;
  area: string | null;
  template: TemplateBody | null;
  finishDate: string | null;
  startDate?: string | null;
  answers: Record<string, unknown>;
  approachAnswers?: Record<string, number>;
  readiness?: Record<string, number>;
  slots?: string[];
  trackingMode: TrackingMode;
  tone: Tone;
  visibility: Visibility;
  summary?: Omit<SummaryVisibility, "goal_id">;
  fieldVisibility?: Record<string, Visibility>;
  why?: string | null;
  whyMediaPath?: string | null;
  starter?: string | null;
  invites?: string[];
  source: "onboarding" | "builder";
}

export type CreateGoalResult =
  | { ok: true; goalId: string; weeks: { week: number; titles: string[] }[]; summary: string; usedAi: boolean; starterItemId: string | null; invites: { email: string; url: string }[] }
  | { ok: false; error: string; upgrade?: boolean };

export async function createGoalCore(ctx: { supabase: Db; userId: string; profile: Profile }, input: CreateGoalInput): Promise<CreateGoalResult> {
  const { supabase, userId, profile } = ctx;
  const plan = effectivePlan(profile);
  const lim = limits(plan);

  const [{ count: activeCount }, { count: anyCount }] = await Promise.all([
    supabase.from("gk_goals").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "active"),
    supabase.from("gk_goals").select("id", { count: "exact", head: true }).eq("owner_id", userId),
  ]);
  if ((activeCount ?? 0) >= lim.activeGoals) {
    return { ok: false, upgrade: true, error: "The free plan holds one active goal. Finish or pause it, or upgrade for more." };
  }

  const today = todayIn(profile.timezone);
  const askedStart = typeof input.answers.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.answers.start) ? input.answers.start : null;
  const startDate = input.startDate ?? (askedStart && askedStart >= today ? askedStart : today);
  const finishDate = input.finishDate && input.finishDate > startDate ? input.finishDate : null;
  const approach = input.approachAnswers && Object.keys(input.approachAnswers).length ? scoreApproach(input.approachAnswers) : profile.approach ?? null;
  const readiness = input.readiness ?? {};
  const visibility = clampRing(input.visibility, lim.visibility);
  const summary = Object.fromEntries(
    Object.entries(input.summary ?? DEFAULT_SUMMARY_VISIBILITY).map(([k, v]) => [k, clampRing(v as Visibility, lim.visibility)]),
  ) as Omit<SummaryVisibility, "goal_id">;
  const area = input.area ?? input.template?.area ?? null;

  // AI drafting: everyone's first goal; after that it is a Pro feature.
  const aiAllowed = (anyCount ?? 0) === 0 || lim.aiPlanBuilder;
  const sizeExp = await variantFor("first_week_size", userId);
  const firstWeekScale = typeof sizeExp.config.scale === "number" ? sizeExp.config.scale : undefined;
  const answers = { ...input.answers, ...(input.slots?.length ? { week_slots: input.slots } : {}), ...(input.template ? { _template: input.template.id } : {}) };

  let drafted: PlanResult;
  if (aiAllowed) {
    drafted = await draftPlan({
      title: input.title, why: input.why, area, template: input.template, answers, startDate, finishDate,
      approach, readiness, tone: input.tone, minutesPerWeek: minutesFromSlots(input.slots ?? []), firstWeekScale,
    });
  } else {
    const base = buildPlan({ template: input.template, title: input.title, area, startDate, finishDate, approach, readiness, firstWeekScale });
    drafted = { items: base.items, totalWeeks: base.totalWeeks, source: "template", summary: `${base.totalWeeks}-week starter plan. Edit anything.`, ifThen: [{ if: "I miss a planned day", then: "I do a 10-minute version the next day" }] };
  }

  const templateId = (await templateRowExists(supabase, input.template?.id ?? null)) ? input.template!.id : null;
  const { data: goalRow, error: goalErr } = await supabase
    .from("gk_goals")
    .insert({
      owner_id: userId, title: input.title, why: input.why ?? null, why_media_url: input.whyMediaPath ?? null, area,
      template_id: templateId, start_date: startDate, finish_date: finishDate, tracking_mode: input.trackingMode, tone: input.tone,
      approach, answers, readiness, if_then: drafted.ifThen, restart_rule: input.template?.restart_rules ?? null,
      status: "active", visibility,
    })
    .select("*")
    .single();
  if (goalErr || !goalRow) return { ok: false, error: "We couldn't save your goal. Please try again." };
  const goal = goalRow as Goal;

  const fieldDrafts = fieldsFromTemplate(input.template).map((f) => ({
    ...f,
    visibility: clampRing(input.fieldVisibility?.[f.key] ?? f.visibility, lim.visibility),
  }));
  const planRows = drafted.items.map((i) => ({ ...i, goal_id: goal.id }));
  const starter = input.starter?.trim();
  const [fieldsRes, , planRes, starterRes] = await Promise.all([
    fieldDrafts.length ? supabase.from("gk_goal_fields").insert(fieldDrafts.map((f) => ({ ...f, goal_id: goal.id }))).select("*") : Promise.resolve({ data: [] }),
    supabase.from("gk_goal_summary_visibility").insert({ goal_id: goal.id, ...summary }),
    planRows.length ? supabase.from("gk_plan_items").insert(planRows).select("*") : Promise.resolve({ data: [] }),
    starter
      ? supabase.from("gk_plan_items").insert({ goal_id: goal.id, week: 1, due_date: today, title: starter, kind: "action", source: "ai", required: false, sort: -1, duration_min: 2 }).select("id").single()
      : Promise.resolve({ data: null }),
  ]);

  const reminderExp = await variantFor("reminder_timing", userId);
  const time = typeof reminderExp.config.time === "string" ? reminderExp.config.time : "08:00";
  const cadence = TONES.find((t) => t.id === input.tone)?.defaultCadence ?? "daily";
  await supabase.from("gk_reminders").insert(
    (["email", "push"] as const).map((channel) => ({ goal_id: goal.id, user_id: userId, channel, cadence, time_of_day: time, weekday: cadence === "weekly" ? 1 : null })),
  );

  const invites: { email: string; url: string }[] = [];
  const emails = [...new Set((input.invites ?? []).map((e) => e.toLowerCase()))].slice(0, Number.isFinite(lim.chosenPeople) ? lim.chosenPeople : 5);
  if (emails.length) {
    // Frozen preview: exactly what a chosen person will see once they accept.
    const preview = buildSharedView({
      goal, fields: (fieldsRes.data ?? []) as GoalField[], summary, checkIns: [], planItems: (planRes.data ?? []) as PlanItem[], audience: "chosen",
    });
    const { data: rows } = await supabase
      .from("gk_invites")
      .insert(emails.map((email) => ({ inviter_id: userId, email, goal_id: goal.id, preview: preview ?? {} })))
      .select("email, token");
    for (const r of rows ?? []) invites.push({ email: r.email as string, url: `${env.appUrl}/invite/${r.token}` });
  }

  await track(userId, "goal_created", { goal_id: goal.id, source: input.source, template: input.template?.id ?? null, ai: drafted.source === "ai", area });

  const byWeek = new Map<number, string[]>();
  for (const i of drafted.items) byWeek.set(i.week, [...(byWeek.get(i.week) ?? []), i.title]);
  return {
    ok: true,
    goalId: goal.id,
    weeks: [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([week, titles]) => ({ week, titles })),
    summary: drafted.summary,
    usedAi: drafted.source === "ai",
    starterItemId: (starterRes.data as { id: string } | null)?.id ?? null,
    invites,
  };
}
