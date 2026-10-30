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
    const { data } = await supabase.from("gk_profiles").insert({ id: user.id, display_name: name }).select("*").single();
    profile = data;
  }
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
