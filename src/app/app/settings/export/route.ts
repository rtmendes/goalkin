// "Export my data": every gk_* row that belongs to the signed-in person, read through RLS.
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const me = user.id;

  const rows = async (table: string, build: (q: ReturnType<typeof supabase.from>) => PromiseLike<{ data: unknown[] | null }>) => {
    try {
      return (await build(supabase.from(table))).data ?? [];
    } catch {
      return [];
    }
  };

  const goals = (await rows("gk_goals", (q) => q.select("*").eq("owner_id", me))) as { id: string }[];
  const goalIds = goals.map((g) => g.id);
  const byGoal = (table: string) => (goalIds.length ? rows(table, (q) => q.select("*").in("goal_id", goalIds)) : Promise.resolve([]));

  const [profile, fields, summaryVisibility, viewers, planItems, checkIns, consequences, reminders, pushDevices, circles, memberships, encouragements, invites, library, purchases, creator, templates, focusRooms, focusParticipation, experiments] = await Promise.all([
    rows("gk_profiles", (q) => q.select("*").eq("id", me)),
    byGoal("gk_goal_fields"),
    byGoal("gk_goal_summary_visibility"),
    byGoal("gk_goal_viewers"),
    byGoal("gk_plan_items"),
    rows("gk_check_ins", (q) => q.select("*").eq("user_id", me)),
    rows("gk_consequences", (q) => (goalIds.length ? q.select("*").or(`set_by.eq.${me},goal_id.in.(${goalIds.join(",")})`) : q.select("*").eq("set_by", me))),
    rows("gk_reminders", (q) => q.select("*").eq("user_id", me)),
    rows("gk_push_subscriptions", (q) => q.select("id,endpoint,created_at").eq("user_id", me)),
    rows("gk_circles", (q) => q.select("*").eq("owner_id", me)),
    rows("gk_circle_members", (q) => q.select("*").eq("user_id", me)),
    rows("gk_encouragements", (q) => q.select("*").or(`from_id.eq.${me},to_id.eq.${me}`)),
    rows("gk_invites", (q) => q.select("*").eq("inviter_id", me)),
    rows("gk_library", (q) => q.select("*").eq("user_id", me)),
    rows("gk_purchases", (q) => q.select("*").eq("user_id", me)),
    rows("gk_creators", (q) => q.select("*").eq("user_id", me)),
    rows("gk_templates", (q) => q.select("*").eq("creator_id", me)),
    rows("gk_focus_rooms", (q) => q.select("*").eq("host_id", me)),
    rows("gk_focus_participants", (q) => q.select("*").eq("user_id", me)),
    rows("gk_experiment_assignments", (q) => q.select("*").eq("user_id", me)),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    account: { id: me, email: user.email ?? null },
    profile: profile[0] ?? null,
    goals, fields, summary_visibility: summaryVisibility, chosen_people: viewers, plan_items: planItems, check_ins: checkIns,
    consequences, reminders, push_devices: pushDevices, circles_led: circles, circle_memberships: memberships,
    encouragements, invites_sent: invites, library, purchases, creator: creator[0] ?? null, templates_created: templates,
    focus_rooms_hosted: focusRooms, focus_participation: focusParticipation, experiment_assignments: experiments,
    note: "Calendar connection tokens are not included; reset or disconnect them in Settings.",
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="goalkin-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
