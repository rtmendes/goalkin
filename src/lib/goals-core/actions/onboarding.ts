"use server";
import * as z from "zod/v4";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { track } from "@/lib/experiments";
import { scoreApproach } from "@/lib/approach";
import type { TemplateBody } from "@/lib/types";
import { onboardingSchema, ownsMediaPath } from "@/lib/goals-core/rules";
import { canUseTemplate, loadTemplateBody } from "@/lib/goals-core/server";
import { createGoalCore, type CreateGoalResult } from "@/lib/goals-core/create";
import { todayIn } from "@/lib/goals-core/dates";

export async function getOnboardingTemplate(id: string): Promise<{ body: TemplateBody; usable: boolean } | null> {
  const { supabase, user } = await requireUser("/onboarding");
  const t = await loadTemplateBody(String(id));
  if (!t) return null;
  return { body: t.body, usable: await canUseTemplate(supabase, user.id, t.listing) };
}

const EVENTS = ["onboarding_started", "onboarding_step"] as const;

export async function logOnboarding(name: (typeof EVENTS)[number], props: { step?: string; index?: number; variant?: string } = {}) {
  if (!EVENTS.includes(name)) return;
  const { user } = await requireUser("/onboarding");
  await track(user.id, name, {
    step: typeof props.step === "string" ? props.step.slice(0, 30) : undefined,
    index: typeof props.index === "number" ? props.index : undefined,
    variant: typeof props.variant === "string" ? props.variant.slice(0, 30) : undefined,
  });
}

export async function createGoalFromOnboarding(raw: unknown): Promise<CreateGoalResult> {
  const { supabase, user, profile } = await requireUser("/onboarding");
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Something in the form looks off. Check the goal sentence and emails." };
  const p = parsed.data;

  let template: TemplateBody | null = null;
  if (p.templateId) {
    const t = await loadTemplateBody(p.templateId);
    if (t && (await canUseTemplate(supabase, user.id, t.listing))) template = t.body;
  }
  const whyMediaPath = ownsMediaPath(p.whyMediaPath, user.id, "why") ? p.whyMediaPath : null;

  const result = await createGoalCore(
    { supabase, userId: user.id, profile },
    {
      title: p.title, area: p.area, template, finishDate: p.finishDate, answers: p.answers, approachAnswers: p.approachAnswers,
      readiness: p.readiness, slots: p.slots, trackingMode: p.trackingMode, tone: p.tone, visibility: p.visibility, summary: p.summary,
      fieldVisibility: p.fieldVisibility, why: p.why, whyMediaPath, starter: p.starter, invites: p.invites, source: "onboarding",
    },
  );
  if (result.ok) {
    await supabase
      .from("gk_profiles")
      .update({
        ...(Object.keys(p.approachAnswers).length ? { approach: scoreApproach(p.approachAnswers) } : {}),
        ...(Object.keys(p.readiness).length ? { readiness: p.readiness } : {}),
        default_tone: p.tone,
        onboarded_at: profile.onboarded_at ?? new Date().toISOString(),
      })
      .eq("id", user.id);
    revalidatePath("/app");
  }
  return result;
}

/** Step 9: tick the starter action and record today's check-in. */
export async function completeFirstWin(goalId: string, itemId: string | null): Promise<{ ok: boolean }> {
  const ids = z.object({ goalId: z.uuid(), itemId: z.uuid().nullable() }).safeParse({ goalId, itemId });
  if (!ids.success) return { ok: false };
  const { supabase, user, profile } = await requireUser("/onboarding");
  const { data: goal } = await supabase.from("gk_goals").select("id").eq("id", goalId).maybeSingle();
  if (!goal) return { ok: false };
  if (itemId) await supabase.from("gk_plan_items").update({ done: true, done_at: new Date().toISOString() }).eq("id", itemId).eq("goal_id", goalId);
  const { error } = await supabase
    .from("gk_check_ins")
    .upsert({ goal_id: goalId, user_id: user.id, day: todayIn(profile.timezone), status: "done", note: "First win" }, { onConflict: "goal_id,day" });
  revalidatePath("/app");
  return { ok: !error };
}
