"use server";
import { redirect } from "next/navigation";
import * as z from "zod/v4";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureTemplateRow } from "@/lib/marketplace/ensure";
import { track } from "@/lib/experiments";

const Id = z.string().regex(/^[a-z0-9-]+$/).max(80);

/** Add a free template to the person's library, then start onboarding with it. */
export async function addFreeTemplate(form: FormData) {
  const parsed = Id.safeParse(form.get("id"));
  if (!parsed.success) redirect("/marketplace");
  const id = parsed.data;
  const { user } = await requireUser(`/marketplace/${id}`);

  let ok = false;
  try {
    // gk_library has no insert policy for people; the service role writes it
    // after checking the template really is free and published.
    const db = createAdminClient();
    const row = await ensureTemplateRow(db, id);
    if (row && row.status === "published" && row.tier === "Free" && row.price === 0) {
      const { error } = await db.from("gk_library").upsert({ user_id: user.id, template_id: id, source: "free" }, { onConflict: "user_id,template_id", ignoreDuplicates: true });
      ok = !error;
      if (error) console.error("addFreeTemplate", error.message);
    }
  } catch (err) {
    console.error("addFreeTemplate", err);
  }
  if (!ok) redirect(`/marketplace/${id}?error=library`);
  await track(user.id, "template_added", { template_id: id, source: "free" });
  redirect(`/onboarding?template=${id}`);
}
