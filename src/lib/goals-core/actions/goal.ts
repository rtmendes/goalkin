"use server";
// Owner-only goal mutations, used as form actions. Every action re-reads the goal
// through the RLS client, so a person can only change their own goals.
import * as z from "zod/v4";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { draftPlan } from "@/lib/ai";
import { effectivePlan, limits } from "@/lib/entitlements";
import type { Goal, PlanItem } from "@/lib/types";
import { clampRing, dateSchema, ownsMediaPath, ringSchema, toneSchema } from "@/lib/goals-core/rules";
import { addDays, todayIn, weekOf } from "@/lib/goals-core/dates";
import { slugKey } from "@/lib/goals-core/template-shape";
import { canUseTemplate, loadTemplateBody, maybeAdmin, type Db } from "@/lib/goals-core/server";
import { createGoalCore } from "@/lib/goals-core/create";

const uuid = z.uuid();
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
const optDate = (v: string) => (v && dateSchema.safeParse(v).success ? v : null);

async function ownGoal(supabase: Db, goalId: string): Promise<Goal | null> {
  if (!uuid.safeParse(goalId).success) return null;
  const { data } = await supabase.from("gk_goals").select("*").eq("id", goalId).maybeSingle();
  return (data as Goal) ?? null;
}

function refresh(goalId: string) {
  revalidatePath(`/app/goals/${goalId}`);
  revalidatePath("/app");
  revalidatePath("/app/goals");
}

// Plan items ---------------------------------------------------------------

export async function toggleItemDone(fd: FormData) {
  const { supabase } = await requireUser();
  const goalId = s(fd, "goalId");
  const id = s(fd, "itemId");
  if (!(await ownGoal(supabase, goalId)) || !uuid.safeParse(id).success) return;
  const done = s(fd, "done") === "true";
  await supabase.from("gk_plan_items").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id).eq("goal_id", goalId);
  refresh(goalId);
}

export async function updateItem(fd: FormData) {
  const { supabase } = await requireUser();
  const goalId = s(fd, "goalId");
  const id = s(fd, "itemId");
  const goal = await ownGoal(supabase, goalId);
  if (!goal || !uuid.safeParse(id).success) return;
  const title = s(fd, "title").slice(0, 140);
  if (!title) return;
  const due = optDate(s(fd, "due_date"));
  const { data: item } = await supabase.from("gk_plan_items").select("required, kind").eq("id", id).eq("goal_id", goalId).maybeSingle();
  if (!item) return;
  // Guardrail wording stays as written; only notes and date can change.
  await supabase
    .from("gk_plan_items")
    .update({
      ...(item.required ? {} : { title }),
      notes: s(fd, "notes").slice(0, 500) || null,
      due_date: due,
      ...(due ? { week: weekOf(goal.start_date, due) } : {}),
    })
    .eq("id", id)
    .eq("goal_id", goalId);
  refresh(goalId);
}

export async function deleteItem(fd: FormData) {
  const { supabase } = await requireUser();
  const goalId = s(fd, "goalId");
  const id = s(fd, "itemId");
  if (!(await ownGoal(supabase, goalId)) || !uuid.safeParse(id).success) return;
  // Required guardrails can be completed but never deleted.
  await supabase.from("gk_plan_items").delete().eq("id", id).eq("goal_id", goalId).eq("required", false);
  refresh(goalId);
}

export async function addItem(fd: FormData) {
  const { supabase, profile } = await requireUser();
  const goalId = s(fd, "goalId");
  const goal = await ownGoal(supabase, goalId);
  const title = s(fd, "title").slice(0, 140);
  if (!goal || !title) return;
  const due = optDate(s(fd, "due_date")) ?? todayIn(profile.timezone);
  const kind = z.enum(["action", "session", "benchmark", "milestone", "reward", "gather", "checkin"]).catch("action").parse(s(fd, "kind") || "action");
  await supabase.from("gk_plan_items").insert({
    goal_id: goalId, title, notes: s(fd, "notes").slice(0, 500) || null, due_date: due, week: weekOf(goal.start_date, due),
    kind, source: "person", required: false, sort: 1000,
  });
  refresh(goalId);
}

/** Pro: redraft upcoming AI/template items; keeps the person's own items, done items and guardrails. */
export async function regeneratePlan(fd: FormData) {
  const { supabase, profile } = await requireUser();
  const goalId = s(fd, "goalId");
  const goal = await ownGoal(supabase, goalId);
  if (!goal) return;
  if (!limits(effectivePlan(profile)).aiPlanBuilder) redirect("/pricing");
  const today = todayIn(profile.timezone);
  const templateId = (goal.answers?._template as string | undefined) ?? goal.template_id;
  const template = templateId ? (await loadTemplateBody(templateId))?.body ?? null : null;
  const { data: existing } = await supabase.from("gk_plan_items").select("title, kind, required").eq("goal_id", goalId);
  const result = await draftPlan({
    title: goal.title, why: goal.why, area: goal.area, template, answers: goal.answers, startDate: goal.start_date,
    finishDate: goal.finish_date, approach: goal.approach ?? profile.approach, readiness: goal.readiness, tone: goal.tone,
  });
  const guardrailTitles = new Set((existing ?? []).filter((e) => e.required).map((e) => e.title as string));
  const fresh = result.items.filter((i) => (i.kind === "guardrail" ? !guardrailTitles.has(i.title) : (i.due_date ?? today) >= today));
  await supabase.from("gk_plan_items").delete().eq("goal_id", goalId).eq("done", false).eq("required", false).neq("source", "person").gte("due_date", today);
  if (fresh.length) await supabase.from("gk_plan_items").insert(fresh.map((i) => ({ ...i, goal_id: goalId })));
  if (result.ifThen.length && !goal.if_then?.length) await supabase.from("gk_goals").update({ if_then: result.ifThen }).eq("id", goalId);
  refresh(goalId);
}

// Check-ins ----------------------------------------------------------------

export async function saveCheckIn(fd: FormData) {
  const { supabase, user, profile } = await requireUser();
  const goalId = s(fd, "goalId");
  const goal = await ownGoal(supabase, goalId);
  if (!goal) return;
  const status = z.enum(["done", "partly", "missed"]).safeParse(s(fd, "status"));
  if (!status.success) return;
  const today = todayIn(profile.timezone);
  const day = optDate(s(fd, "day")) ?? today;
  if (day > today) return;
  const { data: fields } = await supabase.from("gk_goal_fields").select("key, kind").eq("goal_id", goalId);
  const values: Record<string, number> = {};
  for (const f of fields ?? []) {
    const raw = s(fd, `v_${f.key}`);
    if (!raw) continue;
    const n = f.kind === "yes_no" ? (raw === "yes" ? 1 : raw === "no" ? 0 : NaN) : Number(raw);
    if (Number.isFinite(n) && Math.abs(n) < 1e9) values[f.key as string] = n;
  }
  const rating = Number(s(fd, "rating"));
  const photo = s(fd, "photoPath");
  await supabase.from("gk_check_ins").upsert(
    {
      goal_id: goalId, user_id: user.id, day, status: status.data,
      note: s(fd, "note").slice(0, 1000) || null,
      rating: rating >= 1 && rating <= 5 ? Math.round(rating) : null,
      photo_url: ownsMediaPath(photo, user.id, "checkins") ? photo : null,
      values,
    },
    { onConflict: "goal_id,day" },
  );
  refresh(goalId);
  const back = s(fd, "back");
  if (back === "today") redirect("/app?checked=1");
}

// Tracking fields ------------------------------------------------------------

const kindSchema = z.enum(["number", "yes_no", "rating", "note", "money", "duration", "percent", "photo"]);

export async function addField(fd: FormData) {
  const { supabase, profile } = await requireUser();
  const goalId = s(fd, "goalId");
  if (!(await ownGoal(supabase, goalId))) return;
  const label = s(fd, "label").slice(0, 60);
  const kind = kindSchema.safeParse(s(fd, "kind"));
  if (!label || !kind.success) return;
  const ring = ringSchema.catch("private").parse(s(fd, "visibility") || "private");
  const target = Number(s(fd, "target"));
  const { data: existing } = await supabase.from("gk_goal_fields").select("key").eq("goal_id", goalId);
  let key = slugKey(label);
  const taken = new Set((existing ?? []).map((e) => e.key as string));
  for (let i = 2; taken.has(key); i++) key = `${slugKey(label)}_${i}`;
  await supabase.from("gk_goal_fields").insert({
    goal_id: goalId, key, label, kind: kind.data, unit: s(fd, "unit").slice(0, 20) || null,
    target: Number.isFinite(target) && target > 0 ? target : null,
    visibility: clampRing(ring, limits(effectivePlan(profile)).visibility), sort: (existing?.length ?? 0) + 1,
  });
  refresh(goalId);
}

export async function updateField(fd: FormData) {
  const { supabase, profile } = await requireUser();
  const goalId = s(fd, "goalId");
  const id = s(fd, "fieldId");
  if (!(await ownGoal(supabase, goalId)) || !uuid.safeParse(id).success) return;
  const ring = ringSchema.catch("private").parse(s(fd, "visibility") || "private");
  const target = Number(s(fd, "target"));
  const label = s(fd, "label").slice(0, 60);
  await supabase
    .from("gk_goal_fields")
    .update({
      ...(label ? { label } : {}),
      unit: s(fd, "unit").slice(0, 20) || null,
      target: Number.isFinite(target) && target > 0 ? target : null,
      visibility: clampRing(ring, limits(effectivePlan(profile)).visibility),
    })
    .eq("id", id)
    .eq("goal_id", goalId);
  refresh(goalId);
}

export async function deleteField(fd: FormData) {
  const { supabase } = await requireUser();
  const goalId = s(fd, "goalId");
  const id = s(fd, "fieldId");
  if (!(await ownGoal(supabase, goalId)) || !uuid.safeParse(id).success) return;
  await supabase.from("gk_goal_fields").delete().eq("id", id).eq("goal_id", goalId);
  refresh(goalId);
}

// If-then plans --------------------------------------------------------------

export async function saveIfThen(fd: FormData) {
  const { supabase } = await requireUser();
  const goalId = s(fd, "goalId");
  if (!(await ownGoal(supabase, goalId))) return;
  const ifs = fd.getAll("if").map(String);
  const thens = fd.getAll("then").map(String);
  const rows = ifs
    .map((i, idx) => ({ if: i.trim().slice(0, 140), then: (thens[idx] ?? "").trim().slice(0, 140) }))
    .filter((r) => r.if && r.then)
    .slice(0, 8);
  await supabase.from("gk_goals").update({ if_then: rows }).eq("id", goalId);
  refresh(goalId);
}

// Consequences ---------------------------------------------------------------

export async function addConsequence(fd: FormData) {
  const { supabase, user } = await requireUser();
  const goalId = s(fd, "goalId");
  if (!(await ownGoal(supabase, goalId))) return;
  const description = s(fd, "description").slice(0, 280);
  if (!description) return;
  const kind = z.enum(["self", "cause_pledge"]).catch("self").parse(s(fd, "kind") || "self");
  // Self-set consequences are accepted by definition.
  await supabase.from("gk_consequences").insert({ goal_id: goalId, set_by: user.id, kind, description, trigger_rule: s(fd, "trigger").slice(0, 140) || null, accepted: true });
  refresh(goalId);
}

export async function respondToDare(fd: FormData) {
  const { supabase } = await requireUser();
  const goalId = s(fd, "goalId");
  const id = s(fd, "consequenceId");
  if (!(await ownGoal(supabase, goalId)) || !uuid.safeParse(id).success) return;
  if (s(fd, "answer") === "accept") {
    // RLS only lets the setter write the row, so the owner's acceptance goes through the service role after the ownership check above.
    const admin = maybeAdmin();
    if (admin) await admin.from("gk_consequences").update({ accepted: true }).eq("id", id).eq("goal_id", goalId);
  } else {
    await supabase.from("gk_consequences").delete().eq("id", id).eq("goal_id", goalId);
  }
  refresh(goalId);
}

export async function deleteConsequence(fd: FormData) {
  const { supabase } = await requireUser();
  const goalId = s(fd, "goalId");
  const id = s(fd, "consequenceId");
  if (!(await ownGoal(supabase, goalId)) || !uuid.safeParse(id).success) return;
  await supabase.from("gk_consequences").delete().eq("id", id).eq("goal_id", goalId);
  refresh(goalId);
}

// Goal basics and status -----------------------------------------------------

export async function updateGoalBasics(fd: FormData) {
  const { supabase } = await requireUser();
  const goalId = s(fd, "goalId");
  const goal = await ownGoal(supabase, goalId);
  if (!goal) return;
  const title = s(fd, "title").slice(0, 140);
  const finish = optDate(s(fd, "finish_date"));
  await supabase
    .from("gk_goals")
    .update({
      ...(title.length >= 2 ? { title } : {}),
      why: s(fd, "why").slice(0, 1000) || null,
      finish_date: finish && finish > goal.start_date ? finish : null,
      tone: toneSchema.catch(goal.tone).parse(s(fd, "tone") || goal.tone),
      tracking_mode: z.enum(["detailed", "simple", "reflective"]).catch(goal.tracking_mode).parse(s(fd, "tracking_mode") || goal.tracking_mode),
    })
    .eq("id", goalId);
  refresh(goalId);
}

export async function setGoalStatus(fd: FormData) {
  const { supabase, user, profile } = await requireUser();
  const goalId = s(fd, "goalId");
  const goal = await ownGoal(supabase, goalId);
  const status = z.enum(["active", "paused", "finished", "archived"]).safeParse(s(fd, "status"));
  if (!goal || !status.success) return;
  if (status.data === "active" && goal.status !== "active") {
    const { count } = await supabase.from("gk_goals").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "active");
    if ((count ?? 0) >= limits(effectivePlan(profile)).activeGoals) redirect("/pricing");
  }
  await supabase
    .from("gk_goals")
    .update({ status: status.data, finished_at: status.data === "finished" ? new Date().toISOString() : status.data === "active" ? null : goal.finished_at })
    .eq("id", goalId);
  refresh(goalId);
  if (status.data === "finished") redirect(`/app/goals/${goalId}/certificate`);
}

// Reminders ------------------------------------------------------------------

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export async function addReminder(fd: FormData) {
  const { supabase, user } = await requireUser();
  const goalId = s(fd, "goalId");
  if (!(await ownGoal(supabase, goalId))) return;
  const channel = z.enum(["email", "push", "calendar"]).safeParse(s(fd, "channel"));
  const cadence = z.enum(["daily", "weekdays", "weekly"]).safeParse(s(fd, "cadence"));
  const time = timeSchema.safeParse(s(fd, "time"));
  if (!channel.success || !cadence.success || !time.success) return;
  const weekday = Number(s(fd, "weekday"));
  await supabase.from("gk_reminders").insert({
    goal_id: goalId, user_id: user.id, channel: channel.data, cadence: cadence.data, time_of_day: time.data,
    weekday: cadence.data === "weekly" && weekday >= 0 && weekday <= 6 ? weekday : null,
  });
  refresh(goalId);
}

export async function updateReminder(fd: FormData) {
  const { supabase } = await requireUser();
  const goalId = s(fd, "goalId");
  const id = s(fd, "reminderId");
  if (!(await ownGoal(supabase, goalId)) || !uuid.safeParse(id).success) return;
  const time = timeSchema.safeParse(s(fd, "time"));
  const cadence = z.enum(["daily", "weekdays", "weekly"]).safeParse(s(fd, "cadence"));
  await supabase
    .from("gk_reminders")
    .update({
      active: s(fd, "active") === "on",
      ...(time.success ? { time_of_day: time.data } : {}),
      ...(cadence.success ? { cadence: cadence.data } : {}),
    })
    .eq("id", id)
    .eq("goal_id", goalId);
  refresh(goalId);
}

export async function deleteReminder(fd: FormData) {
  const { supabase } = await requireUser();
  const goalId = s(fd, "goalId");
  const id = s(fd, "reminderId");
  if (!(await ownGoal(supabase, goalId)) || !uuid.safeParse(id).success) return;
  await supabase.from("gk_reminders").delete().eq("id", id).eq("goal_id", goalId);
  refresh(goalId);
}

// Compact builder (/app/goals/new) ---------------------------------------------

export async function createGoalFromBuilder(fd: FormData) {
  const { supabase, user, profile } = await requireUser("/app/goals/new");
  const title = s(fd, "title");
  if (title.length < 2) redirect("/app/goals/new?error=title");
  const templateId = s(fd, "templateId");
  let template = null;
  if (templateId) {
    const t = await loadTemplateBody(templateId);
    if (t && (await canUseTemplate(supabase, user.id, t.listing))) template = t.body;
  }
  const result = await createGoalCore(
    { supabase, userId: user.id, profile },
    {
      title: title.slice(0, 140), area: s(fd, "area").slice(0, 60) || null, template,
      finishDate: optDate(s(fd, "finish_date")), answers: {}, why: s(fd, "why").slice(0, 1000) || null,
      trackingMode: z.enum(["detailed", "simple", "reflective"]).catch("simple").parse(s(fd, "tracking_mode") || "simple"),
      tone: toneSchema.catch(profile.default_tone).parse(s(fd, "tone") || profile.default_tone),
      visibility: "private", source: "builder",
    },
  );
  if (!result.ok) redirect(result.upgrade ? "/app/goals/new?error=limit" : "/app/goals/new?error=save");
  redirect(`/app/goals/${result.goalId}`);
}

/** Move missed, undone items from before today onto the next few days (restart plan helper). */
export async function rescheduleMissed(fd: FormData) {
  const { supabase, profile } = await requireUser();
  const goalId = s(fd, "goalId");
  const goal = await ownGoal(supabase, goalId);
  if (!goal) return;
  const today = todayIn(profile.timezone);
  const { data } = await supabase.from("gk_plan_items").select("id").eq("goal_id", goalId).eq("done", false).lt("due_date", today).order("due_date").limit(30);
  const items = (data ?? []) as Pick<PlanItem, "id">[];
  await Promise.all(
    items.map((it, i) => {
      const due = addDays(today, Math.floor(i / 2) + 1);
      return supabase.from("gk_plan_items").update({ due_date: due, week: weekOf(goal.start_date, due) }).eq("id", it.id).eq("goal_id", goalId);
    }),
  );
  refresh(goalId);
}
