import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import type { Profile } from "@/lib/types";

export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

/** Signed-in person plus their GoalKin profile (created on first visit). */
export async function requireUser(next = "/app") {
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  let { data: profile } = await supabase.from("gk_profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) {
    const name = (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? null;
    // Layout and page render in parallel on the first visit, so ignore a duplicate. The re-read
    // must differ from the first lookup: React memoizes identical GETs within one request.
    await supabase.from("gk_profiles").upsert({ id: user.id, display_name: name }, { onConflict: "id", ignoreDuplicates: true });
    ({ data: profile } = await supabase.from("gk_profiles").select("*").eq("id", user.id).limit(1).maybeSingle());
  }
  if (!profile) throw new Error("Could not load or create your GoalKin profile");
  return { supabase, user, profile: profile as Profile };
}

export function isAdminEmail(email: string | null | undefined) {
  return !!email && serverEnv().adminEmails.includes(email.toLowerCase());
}

export async function requireAdmin() {
  const ctx = await requireUser("/admin");
  if (!isAdminEmail(ctx.user.email)) redirect("/app");
  return ctx;
}
