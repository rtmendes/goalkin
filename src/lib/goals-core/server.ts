import "server-only";
import { randomBytes } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate, readCatalog, type Listing } from "@/lib/templates";
import { bodyFromCatalog } from "@/lib/goals-core/template-shape";
import type { TemplateBody } from "@/lib/types";

export type Db = Awaited<ReturnType<typeof createClient>>;

export const newShareToken = () => randomBytes(12).toString("hex"); // 24 hex chars

/** Full template body: database or repo JSON first, then a body built from the catalog row. */
export async function loadTemplateBody(id: string): Promise<{ body: TemplateBody; listing: Pick<Listing, "id" | "name" | "area" | "tier" | "price" | "creator_id"> } | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const found = await getTemplate(id).catch(() => null);
  if (found) return found;
  const row = (await readCatalog().catch(() => [])).find((c) => c.id === id);
  if (!row) return null;
  const body = bodyFromCatalog(row);
  return { body, listing: { id: row.id, name: row.name, area: row.area, tier: row.tier, price: 0, creator_id: null } };
}

/** Free templates are open to everyone; paid ones need a library row (or authorship). */
export async function canUseTemplate(supabase: Db, userId: string, listing: { id: string; tier: string; creator_id: string | null }) {
  if (listing.tier === "Free" || listing.creator_id === userId) return true;
  const { data } = await supabase.from("gk_library").select("template_id").eq("user_id", userId).eq("template_id", listing.id).maybeSingle();
  return !!data;
}

/** goal.template_id is a foreign key, so only set it when the template row exists. */
export async function templateRowExists(supabase: Db, id: string | null) {
  if (!id) return false;
  const { data } = await supabase.from("gk_templates").select("id").eq("id", id).maybeSingle();
  return !!data;
}

export async function signedMedia(supabase: Db, path: string | null | undefined, seconds = 3600): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  try {
    const { data } = await supabase.storage.from("gk-media").createSignedUrl(path, seconds);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** Service-role client, or null when it is not configured (so pages degrade instead of crashing). */
export function maybeAdmin() {
  try {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : null;
  } catch {
    return null;
  }
}

export const isMediaAudio = (path: string | null | undefined) => !!path && /\.(m4a|mp3|wav|ogg|webm|aac)$/i.test(path);
