"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod/v4";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoChecks, MANUAL_CHECKS } from "@/lib/marketplace/review";
import { checkoutHref } from "@/lib/commerce/checkout";

const Review = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(80),
  decision: z.enum(["approved", "changes_requested", "rejected"]),
  note: z.string().trim().max(2000).optional(),
  checkout_url: z.string().trim().max(500).optional(),
});

const STATUS_AFTER = { approved: "published", changes_requested: "draft", rejected: "rejected" } as const;

export async function reviewTemplate(form: FormData) {
  const { user } = await requireAdmin();
  const parsed = Review.safeParse({
    id: form.get("id"), decision: form.get("decision"), note: form.get("note") ?? undefined, checkout_url: form.get("checkout_url") ?? undefined,
  });
  if (!parsed.success) redirect("/admin?error=review");
  const { id, decision, note, checkout_url } = parsed.data;
  const db = createAdminClient();
  const { data: t } = await db.from("gk_templates").select("body, status, tier, price").eq("id", id).maybeSingle();
  if (!t || t.status !== "in_review") redirect(`/admin?error=not_in_review`);

  // Re-run the automatic checks on the server; the form ticks only cover the manual ones.
  const auto = autoChecks(t.body, new Date().toISOString().slice(0, 10));
  const manual = Object.fromEntries(MANUAL_CHECKS.map((c) => [c.id, form.get(c.id) === "yes"]));
  const checklist = {
    schema: auto.schema.ok, plan_test: auto.planTest.ok, claims_auto: auto.claims.ok, doctor_step: auto.doctorStep.ok,
    visibility_private: auto.visibility.ok, ...manual,
  };
  const allPass = Object.values(checklist).every(Boolean);
  if (decision === "approved" && !allPass) redirect(`/admin/review/${id}?error=checklist`);
  if (decision !== "approved" && !note) redirect(`/admin/review/${id}?error=note`);

  const checkout = checkout_url ? checkoutHref(checkout_url) : null;
  if (checkout_url && !checkout) redirect(`/admin/review/${id}?error=checkout`);

  const { error: revErr } = await db.from("gk_template_reviews").insert({ template_id: id, reviewer_id: user.id, checklist, decision, note: note || null });
  if (revErr) {
    console.error("reviewTemplate", revErr.message);
    redirect(`/admin/review/${id}?error=save`);
  }
  const update: Record<string, unknown> = { status: STATUS_AFTER[decision] };
  if (decision === "approved" && checkout) update.checkout_url = checkout;
  await db.from("gk_templates").update(update).eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/marketplace");
  redirect(`/admin?reviewed=${id}`);
}

const CreatorDecision = z.object({ user_id: z.uuid(), decision: z.enum(["approved", "rejected"]) });

export async function decideCreator(form: FormData) {
  await requireAdmin();
  const parsed = CreatorDecision.safeParse({ user_id: form.get("user_id"), decision: form.get("decision") });
  if (!parsed.success) redirect("/admin?error=creator");
  const db = createAdminClient();
  const { error } = await db.from("gk_creators").update({ status: parsed.data.decision }).eq("user_id", parsed.data.user_id);
  if (error) redirect("/admin?error=creator");
  revalidatePath("/admin");
  redirect("/admin#creators");
}
