import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public display names of creators (only the name; payout details never leave
 * the server). gk_creators is self-read under RLS, so this uses the service role.
 */
export async function creatorNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, string>();
  if (!unique.length) return out;
  try {
    const { data } = await createAdminClient().from("gk_creators").select("user_id, display_name").in("user_id", unique);
    for (const r of data ?? []) out.set(r.user_id as string, r.display_name as string);
  } catch {
    /* names are decoration; never block the page */
  }
  return out;
}
