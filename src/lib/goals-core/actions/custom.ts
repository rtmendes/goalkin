"use server";
import * as z from "zod/v4";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { draftPlan } from "@/lib/ai";
import { effectivePlan, limits } from "@/lib/entitlements";
import { AREAS } from "@/lib/goals-core/areas";
import { bodyFromCustomPlan, CUSTOM_QUESTIONS, type CustomItem } from "@/lib/goals-core/custom-interview";
import { addDays, todayIn } from "@/lib/goals-core/dates";
import { slugKey } from "@/lib/goals-core/template-shape";
import { maybeAdmin } from "@/lib/goals-core/server";

const areaSchema = z.enum(AREAS.map((a) => a.id) as [string, ...string[]]);
const answersSchema = z.record(z.string().max(30), z.string().max(600));

export type DraftCustomResult = { ok: true; items: CustomItem[]; summary: string; usedAi: boolean } | { ok: false; error: string; upgrade?: boolean };

export async function draftCustomPlan(raw: unknown): Promise<DraftCustomResult> {
  const { profile } = await requireUser("/app/custom");
  if (!limits(effectivePlan(profile)).aiPlanBuilder) return { ok: false, upgrade: true, error: "Advanced custom templates are part of Pro." };
  const parsed = z.object({ area: areaSchema, answers: answersSchema }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Pick an area and answer the first question." };
  const { area, answers } = parsed.data;
  const known = Object.fromEntries(CUSTOM_QUESTIONS.map((q) => [q.id, answers[q.id] ?? ""]).filter(([, v]) => v));
  const title = (known.goal as string | undefined)?.trim();
  if (!title) return { ok: false, error: "Tell us the goal first." };
  const weeks = Math.min(52, Math.max(1, Number(known.weeks) || 8));
  const start = todayIn(profile.timezone);
  const res = await draftPlan({
    title, area, template: null, answers: known, startDate: start, finishDate: addDays(start, weeks * 7 - 1),
    approach: profile.approach, readiness: profile.readiness, tone: profile.default_tone,
    minutesPerWeek: Number(known.minutes) || null, deeper: true,
  });
  return {
    ok: true,
    usedAi: res.source === "ai",
    summary: res.summary,
    items: res.items.slice(0, 300).map((i) => ({ week: i.week, title: i.title, kind: i.kind, notes: i.notes })),
  };
}

const itemSchema = z.object({
  week: z.number().int().min(1).max(104),
  title: z.string().trim().min(1).max(140),
  kind: z.enum(["action", "session", "benchmark", "checkin", "milestone", "reward", "gather", "guardrail"]),
  notes: z.string().max(280).nullable().optional(),
});

export type SaveCustomResult = { ok: true; templateId: string } | { ok: false; error: string; upgrade?: boolean };

export async function saveCustomTemplate(raw: unknown): Promise<SaveCustomResult> {
  const { supabase, user, profile } = await requireUser("/app/custom");
  if (!limits(effectivePlan(profile)).aiPlanBuilder) return { ok: false, upgrade: true, error: "Advanced custom templates are part of Pro." };
  const parsed = z
    .object({ name: z.string().trim().min(2).max(80), area: areaSchema, summary: z.string().max(400), restart: z.string().max(200).nullable(), items: z.array(itemSchema).min(1).max(300) })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Give the template a name and keep at least one step." };
  const p = parsed.data;
  const id = `custom-${slugKey(p.name).replace(/_/g, "-").slice(0, 40)}-${randomBytes(3).toString("hex")}`;
  const body = bodyFromCustomPlan({ id, name: p.name, area: p.area, summary: p.summary || `My own ${p.area.toLowerCase()} plan.`, items: p.items, restart: p.restart });

  const { error } = await supabase.from("gk_templates").insert({
    id, name: p.name, area: p.area, tier: "Custom", price: 0, summary: body.summary, duration: body.duration ?? null,
    body, status: "draft", creator_id: user.id,
  });
  if (error) return { ok: false, error: "We couldn't save the template." };
  // gk_library has no insert policy for people; the service role adds the row after the checks above.
  const admin = maybeAdmin();
  if (admin) await admin.from("gk_library").upsert({ user_id: user.id, template_id: id, source: "custom" }, { onConflict: "user_id,template_id" });
  revalidatePath("/app/library");
  return { ok: true, templateId: id };
}
