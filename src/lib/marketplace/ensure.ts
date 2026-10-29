import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFullTemplate } from "@/lib/templates";

export interface TemplateRow {
  id: string;
  name: string;
  tier: string;
  price: number;
  status: string;
  creator_id: string | null;
  revenue_share: number;
  checkout_url: string | null;
}

/**
 * gk_library references gk_templates, so a repo template (templates/full/*.json)
 * must have a row before anyone can own it. Inserts it as published if missing,
 * never overwriting an existing row. Needs the service-role client.
 */
export async function ensureTemplateRow(db: SupabaseClient, id: string): Promise<TemplateRow | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const cols = "id,name,tier,price,status,creator_id,revenue_share,checkout_url";
  const { data: existing } = await db.from("gk_templates").select(cols).eq("id", id).maybeSingle();
  if (existing) return { ...existing, price: Number(existing.price), revenue_share: Number(existing.revenue_share) } as TemplateRow;
  const body = await readFullTemplate(id);
  if (!body) return null;
  const row = {
    id: body.id, name: body.name, area: body.area, tier: body.tier, price: body.price ?? 0,
    summary: body.summary, duration: body.duration ?? null, body, status: "published",
  };
  const { error } = await db.from("gk_templates").upsert(row, { onConflict: "id", ignoreDuplicates: true });
  if (error) {
    console.error("ensureTemplateRow failed", id, error.message);
    return null;
  }
  return { id: row.id, name: row.name, tier: row.tier, price: Number(row.price), status: "published", creator_id: null, revenue_share: 0.7, checkout_url: null };
}
