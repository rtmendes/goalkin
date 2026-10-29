import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";

/**
 * Service-role client: bypasses RLS. Use only on the server, and only for
 * (a) jobs with no signed-in person (cron, webhooks), or
 * (b) building shared views, which MUST go through src/lib/visibility.ts.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, serverEnv().serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
