// Private calendar feed. The 36-hex token in the URL is the only secret, so it
// is looked up with the service role and can be reset from Settings.
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { Goal, PlanItem } from "@/lib/types";
import { buildCalendar, type IcsEvent } from "@/lib/integrations/ics";
import { itemDay, inWindow, planItemToIcs, syncWindow, weeklyCheckinEvents } from "@/lib/integrations/calendar-items";
import { checkinUrl } from "@/lib/integrations/links";
import { localDay, safeZone } from "@/lib/integrations/time";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/i, "");
  if (!/^[a-f0-9]{36}$/.test(token)) return notFound();

  const db = createAdminClient();
  const { data: link } = await db.from("gk_calendar_links").select("user_id").eq("ics_token", token).maybeSingle();
  if (!link) return notFound();
  const userId = link.user_id as string;

  const [{ data: profile }, { data: goalRows }] = await Promise.all([
    db.from("gk_profiles").select("timezone").eq("id", userId).maybeSingle(),
    db.from("gk_goals").select("id,title,start_date,finish_date,status").eq("owner_id", userId).eq("status", "active"),
  ]);
  const tz = safeZone(profile?.timezone as string | undefined);
  const goals = (goalRows ?? []) as Pick<Goal, "id" | "title" | "start_date" | "finish_date" | "status">[];
  const window = syncWindow(localDay(new Date(), tz));

  const { data: itemRows } = goals.length
    ? await db.from("gk_plan_items").select("id,goal_id,title,notes,kind,due_date,starts_at,duration_min,done,required").in("goal_id", goals.map((g) => g.id)).limit(5000)
    : { data: [] };
  const items = (itemRows ?? []) as PlanItem[];

  const events: IcsEvent[] = [];
  for (const goal of goals) {
    const own = items.filter((i) => i.goal_id === goal.id);
    for (const item of own) {
      const day = itemDay(item, tz);
      if (!inWindow(day, window)) continue;
      const ev = planItemToIcs(item, goal, { tz, appUrl: env.appUrl, checkinLink: checkinUrl(goal.id, userId, day) });
      if (ev) events.push(ev);
    }
    if (!own.some((i) => i.kind === "checkin")) {
      events.push(...weeklyCheckinEvents(goal, window, { appUrl: env.appUrl, linkFor: (day) => checkinUrl(goal.id, userId, day) }));
    }
  }

  return new Response(buildCalendar({ name: "GoalKin goals", events }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="goalkin.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
