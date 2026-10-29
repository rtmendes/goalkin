import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkinDayAllowed, verifyCheckinLink } from "@/lib/checkin-link";
import { todayIn } from "@/lib/goals-core/dates";

// One-tap check-in from a reminder email or calendar event:
// /api/checkin?g=<goalId>&d=<yyyy-mm-dd>&s=done|partly|missed&t=<hmac>
// The signed token stands in for a session, so it only ever writes that one
// day's check-in for that goal's owner.

const query = z.object({
  g: z.uuid(),
  d: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  s: z.enum(["done", "partly", "missed"]),
  t: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/app?checkin_error=${reason}`, url.origin), 303);
  const parsed = query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return fail("invalid");
  const { g, d, s, t } = parsed.data;

  let db;
  try {
    db = createAdminClient();
  } catch {
    return fail("unavailable");
  }
  const { data: goal } = await db.from("gk_goals").select("id, owner_id, status").eq("id", g).maybeSingle();
  if (!goal || !verifyCheckinLink(g, goal.owner_id as string, d, t)) return fail("invalid");
  const { data: profile } = await db.from("gk_profiles").select("timezone").eq("id", goal.owner_id).maybeSingle();
  if (!checkinDayAllowed(d, todayIn((profile?.timezone as string | undefined) ?? "UTC"))) return fail("expired");

  const { error } = await db
    .from("gk_check_ins")
    .upsert({ goal_id: g, user_id: goal.owner_id, day: d, status: s }, { onConflict: "goal_id,day" });
  if (error) return fail("unavailable");
  return NextResponse.redirect(new URL("/app?checked=1", url.origin), 303);
}
