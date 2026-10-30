import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { effectivePlan, limits } from "@/lib/entitlements";
import type { Profile } from "@/lib/types";
import { authUrl, googleConfigured, signState, STATE_COOKIE } from "@/lib/integrations/gcal";

const back = (q: string) => NextResponse.redirect(`${env.appUrl}/app/settings?google=${q}#calendar`, 303);

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.redirect(`${env.appUrl}/login?next=${encodeURIComponent("/app/settings#calendar")}`, 303);
  if (!googleConfigured()) return back("unavailable");
  const { data: profile } = await supabase.from("gk_profiles").select("plan,plan_until").eq("id", user.id).maybeSingle();
  if (!profile || !limits(effectivePlan(profile as Pick<Profile, "plan" | "plan_until">)).googleSync) return back("upgrade");

  const nonce = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authUrl(nonce), 303);
  res.cookies.set(STATE_COOKIE, signState(nonce, user.id), {
    httpOnly: true,
    secure: env.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/api/google/oauth",
    maxAge: 600,
  });
  return res;
}
