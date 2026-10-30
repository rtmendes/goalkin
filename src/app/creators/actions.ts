"use server";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod/v4";
import { requireUser } from "@/lib/auth";
import { toTemplateId, validateTemplate, type ClaimHit } from "@/lib/marketplace/template-schema";
import type { TemplateBody } from "@/lib/types";

export interface ApplyState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>; // echoed back so a failed submit keeps what was typed
}

const Apply = z.object({
  display_name: z.string().trim().min(2, { error: "Add the name people will see (2 characters or more)." }).max(60),
  bio: z.string().trim().max(600, { error: "Keep the bio under 600 characters." }).optional(),
  website: z.union([z.literal(""), z.url({ protocol: /^https?$/, error: "Use a full web address starting with https://" })]).optional(),
  payout_email: z.email({ error: "Enter the email where you want payout details sent." }),
  accept: z.literal("yes", { error: "Please accept the creator terms to apply." }),
});

export async function applyAsCreator(_prev: ApplyState, form: FormData): Promise<ApplyState> {
  const { supabase, user } = await requireUser("/creators");
  const values = Object.fromEntries(["display_name", "bio", "website", "payout_email"].map((k) => [k, String(form.get(k) ?? "").slice(0, 600)]));
  const parsed = Apply.safeParse({
    display_name: form.get("display_name") ?? "",
    bio: form.get("bio") ?? "",
    website: form.get("website") ?? "",
    payout_email: String(form.get("payout_email") ?? "").trim().toLowerCase(),
    accept: form.get("accept") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Please fix the highlighted fields.", fieldErrors, values };
  }
  const d = parsed.data;
  const { error } = await supabase.from("gk_creators").insert({
    user_id: user.id, display_name: d.display_name, bio: d.bio || null, website: d.website || null,
    payout_email: d.payout_email, status: "applied", terms_accepted_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") redirect("/creators/dashboard");
    console.error("applyAsCreator", error.message);
    return { error: "We couldn't save your application. Please try again.", values };
  }
  redirect("/creators/dashboard?applied=1");
}

export interface SaveState {
  error?: string;
  errors?: string[];
  claims?: ClaimHit[];
  saved?: boolean;
}

async function approvedCreator() {
  const ctx = await requireUser("/creators/dashboard");
  const { data } = await ctx.supabase.from("gk_creators").select("status").eq("user_id", ctx.user.id).maybeSingle();
  return { ...ctx, approved: data?.status === "approved" };
}

const IdSchema = z.string().regex(/^[a-z0-9-]+$/).max(80);

/** Save a creator template as a draft. Editing anything sends it back to draft (re-submit for review). */
export async function saveTemplate(_prev: SaveState, form: FormData): Promise<SaveState> {
  const { supabase, user, approved } = await approvedCreator();
  if (!approved) return { error: "Only approved creators can save templates." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("body") ?? ""));
  } catch {
    return { error: "The form data was incomplete. Please try again." };
  }
  const existingId = form.get("id") ? IdSchema.safeParse(form.get("id")) : null;
  if (existingId && !existingId.success) return { error: "Unknown template." };
  const id = existingId?.data ?? toTemplateId(String((raw as { name?: unknown })?.name ?? "template"), randomBytes(3).toString("hex"));

  const body = {
    ...(raw as Record<string, unknown>),
    id, tier: "Creator",
    creator: { id: user.id, revenue_share: 0.7, license: "Original work; creator holds the rights (creator terms)." },
  } as TemplateBody;
  const check = validateTemplate(body);
  // Drafts may be saved with problems so work isn't lost, but schema errors must be fixed first.
  if (!check.body) return { error: "Please fix these before saving.", errors: check.errors };

  const today = new Date().toISOString().slice(0, 10);
  const row = {
    name: check.body.name, area: check.body.area, tier: "Creator", price: check.body.price ?? 0, summary: check.body.summary,
    duration: check.body.duration ?? null, status: "draft",
  };

  if (existingId) {
    const { data: prev } = await supabase.from("gk_templates").select("price, body, status").eq("id", id).eq("creator_id", user.id).maybeSingle();
    if (!prev) return { error: "That template isn't yours or no longer exists." };
    if (!["draft", "in_review", "rejected"].includes(prev.status as string)) {
      return { error: "Published or archived templates can't be edited here. Contact us to change one." };
    }
    const log = ((prev.body as TemplateBody)?.price_log ?? []).slice();
    if (Number(prev.price) !== row.price) log.push({ from: Number(prev.price), to: row.price, basis: "Creator set price", date: today });
    const { error } = await supabase.from("gk_templates").update({ ...row, body: { ...check.body, price_log: log } }).eq("id", id).eq("creator_id", user.id);
    if (error) {
      console.error("saveTemplate update", error.message);
      return { error: "We couldn't save your changes. Please try again." };
    }
    revalidatePath(`/creators/templates/${id}/edit`);
    return { saved: true, errors: check.errors, claims: check.claims };
  }

  const { error } = await supabase.from("gk_templates").insert({
    id, ...row, creator_id: user.id, revenue_share: 0.7,
    body: { ...check.body, price_log: [{ from: null, to: row.price, basis: "Creator set price", date: today }] },
  });
  if (error) {
    console.error("saveTemplate insert", error.message);
    return { error: "We couldn't save the template. Please try again." };
  }
  redirect(`/creators/templates/${id}/edit?saved=1`);
}

export async function submitForReview(form: FormData) {
  const parsed = IdSchema.safeParse(form.get("id"));
  if (!parsed.success) redirect("/creators/dashboard");
  const id = parsed.data;
  const { supabase, user, approved } = await approvedCreator();
  if (!approved) redirect("/creators/dashboard");
  const { data } = await supabase.from("gk_templates").select("body, status").eq("id", id).eq("creator_id", user.id).maybeSingle();
  if (!data) redirect("/creators/dashboard");
  const check = validateTemplate(data.body);
  if (!check.ok) redirect(`/creators/templates/${id}/edit?error=invalid`);
  const { error } = await supabase.from("gk_templates").update({ status: "in_review" }).eq("id", id).eq("creator_id", user.id);
  if (error) redirect(`/creators/templates/${id}/edit?error=submit`);
  redirect(`/creators/dashboard?submitted=${id}`);
}
