import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, serverEnv } from "@/lib/env";
import { ensureTemplateRow } from "@/lib/marketplace/ensure";
import { creatorShare, isPlanProduct, nextPlanState, templateIdFor } from "@/lib/commerce/products";
import type { ParsedPurchase } from "@/lib/commerce/payload";
import type { PlanTier } from "@/lib/types";

// A purchase row with user_id = null is "pending": paid before the account
// existed (or before we could match the email). It is applied on next login
// by applyPendingPurchases, called from /auth/callback and the password sign-in.

/** Find an auth user id by email through the GoTrue admin API (service role). */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const key = serverEnv().serviceRoleKey;
  if (!env.supabaseUrl || !key) return null;
  try {
    const url = `${env.supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=50`;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { users?: { id: string; email?: string | null }[] };
    // The filter is a substring match, so confirm the exact address.
    const hit = (json.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
    return hit?.id ?? null;
  } catch {
    return null;
  }
}

interface PurchaseRow {
  id: string;
  user_id: string | null;
  email: string;
  product: string;
  amount: number | null;
}

/** Unlock what a purchase pays for. Safe to call more than once for the same purchase. */
export async function applyEntitlement(db: SupabaseClient, userId: string, p: Pick<PurchaseRow, "product" | "email">) {
  if (isPlanProduct(p.product)) {
    const { data: profile } = await db.from("gk_profiles").select("plan, plan_until").eq("id", userId).maybeSingle();
    const next = nextPlanState(profile as { plan: PlanTier; plan_until: string | null } | null, p.product);
    if (!next) return;
    if (profile) await db.from("gk_profiles").update(next).eq("id", userId);
    else await db.from("gk_profiles").insert({ id: userId, display_name: p.email.split("@")[0], ...next });
    return;
  }
  const templateId = templateIdFor(p.product);
  if (!templateId) return;
  const row = await ensureTemplateRow(db, templateId);
  if (!row) {
    console.error("purchase for unknown template", p.product);
    return;
  }
  await db.from("gk_library").upsert({ user_id: userId, template_id: templateId, source: "purchase" }, { onConflict: "user_id,template_id", ignoreDuplicates: true });
}

/** Record a webhook purchase once (unique provider_ref) and apply it if the buyer has an account. */
export async function recordPurchase(p: ParsedPurchase, raw: unknown): Promise<{ status: "applied" | "pending" | "duplicate" | "unmapped" | "error"; id?: string }> {
  const db = createAdminClient();
  const product = p.product ?? `unknown:${p.productName}`;
  const userId = p.product ? await findUserIdByEmail(p.email) : null;

  let creatorId: string | null = null;
  let share: number | null = null;
  const templateId = p.product ? templateIdFor(p.product) : null;
  if (templateId) {
    const row = await ensureTemplateRow(db, templateId);
    if (row?.creator_id) {
      creatorId = row.creator_id;
      share = creatorShare(p.amount, row.revenue_share);
    }
  }

  const { data, error } = await db
    .from("gk_purchases")
    .upsert(
      {
        user_id: userId, email: p.email, product, amount: p.amount, currency: p.currency, provider: "ghl",
        provider_ref: p.providerRef, creator_id: creatorId, creator_share: share, raw,
      },
      { onConflict: "provider,provider_ref", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    console.error("recordPurchase failed", error.message);
    return { status: "error" };
  }
  const inserted = data?.[0]?.id as string | undefined;
  if (!inserted) return { status: "duplicate" };
  if (!p.product) return { status: "unmapped", id: inserted };
  if (!userId) return { status: "pending", id: inserted };
  await applyEntitlement(db, userId, { product, email: p.email });
  return { status: "applied", id: inserted };
}

/** Claim and apply purchases made with this email before the account existed. Never throws. */
export async function applyPendingPurchases(userId: string, email: string | null | undefined): Promise<number> {
  if (!email || !serverEnv().serviceRoleKey) return 0;
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("gk_purchases")
      .select("id, product, email")
      .is("user_id", null)
      .ilike("email", email.replace(/[%_\\]/g, "\\$&"))
      .order("created_at");
    let applied = 0;
    for (const row of (data ?? []) as Pick<PurchaseRow, "id" | "product" | "email">[]) {
      if (row.product.startsWith("unknown:")) continue;
      // Claim first (only if still unclaimed) so two logins cannot apply it twice.
      const { data: claimed } = await db.from("gk_purchases").update({ user_id: userId }).eq("id", row.id).is("user_id", null).select("id");
      if (!claimed?.length) continue;
      await applyEntitlement(db, userId, row);
      applied++;
    }
    return applied;
  } catch (err) {
    console.error("applyPendingPurchases failed", err);
    return 0;
  }
}
