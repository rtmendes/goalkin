import Link from "next/link";
import { ButtonLink, Card, Empty, Notice, StatusPill } from "@/components/ui";
import { CheckInForm } from "@/components/goals/checkin-form";
import { SharedGoalCard } from "@/components/goals/shared-goal-card";
import { requireUser } from "@/lib/auth";
import { sharedWithMe } from "@/lib/goals";
import { computeProgress, restartPlan } from "@/lib/progress";
import { areaInfo } from "@/lib/goals-core/areas";
import { addDays, formatDay, greeting, hourIn, missedDays, todayIn } from "@/lib/goals-core/dates";
import { toggleItemDone } from "@/lib/goals-core/actions/goal";
import type { CheckIn, Goal, GoalField, PlanItem } from "@/lib/types";
import type { SharedGoalView } from "@/lib/visibility";

export const metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ checked?: string }> }) {
  const { checked } = await searchParams;
  const { supabase, user, profile } = await requireUser("/app");
  const today = todayIn(profile.timezone);

  const { data: goalRows } = await supabase.from("gk_goals").select("*").eq("owner_id", user.id).eq("status", "active").order("created_at");
  const goals = (goalRows ?? []) as Goal[];
  const ids = goals.map((g) => g.id);
  const [itemsRes, checksRes, fieldsRes, allPlanRes] = ids.length
    ? await Promise.all([
        supabase.from("gk_plan_items").select("*").in("goal_id", ids).eq("done", false).lte("due_date", today).order("due_date").order("sort").limit(60),
        supabase.from("gk_check_ins").select("*").in("goal_id", ids).gte("day", addDays(today, -90)),
        supabase.from("gk_goal_fields").select("*").in("goal_id", ids).order("sort"),
        supabase.from("gk_plan_items").select("goal_id, done, kind, due_date").in("goal_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const items = (itemsRes.data ?? []) as PlanItem[];
  const checks = (checksRes.data ?? []) as CheckIn[];
  const fields = (fieldsRes.data ?? []) as GoalField[];
  const allPlan = (allPlanRes.data ?? []) as (Pick<PlanItem, "done" | "kind" | "due_date"> & { goal_id: string })[];

  let shared: { owner: string; view: SharedGoalView }[] = [];
  try {
    shared = await sharedWithMe(user.id);
  } catch {
    shared = [];
  }

  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));
  const firstName = profile.display_name?.split(" ")[0] ?? null;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">{formatDay(today, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{greeting(profile.default_tone, firstName, hourIn(profile.timezone))}</h1>
      </header>
      {checked && <Notice>Checked in. Nice work showing up.</Notice>}

      {goals.length === 0 ? (
        <Empty title="Nothing on today's list yet">
          <p>Pick an area, say your goal in one sentence, and we’ll draft a plan you can edit. About three minutes.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <ButtonLink href="/onboarding">Start my first goal</ButtonLink>
            <ButtonLink href="/app/goals" variant="secondary">See all goals</ButtonLink>
          </div>
        </Empty>
      ) : (
        <>
          <Card>
            <h2 className="mb-3 font-display text-xl font-bold">Today’s steps</h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted">All clear for today. Check in below, or add a step on a goal page.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 rounded-xl border border-line p-2">
                    <form action={toggleItemDone}>
                      <input type="hidden" name="goalId" value={i.goal_id} />
                      <input type="hidden" name="itemId" value={i.id} />
                      <input type="hidden" name="done" value="true" />
                      <button aria-label={`Mark "${i.title}" done`} className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-lg hover:bg-surface-2">
                        <span aria-hidden className="text-muted">✓</span>
                      </button>
                    </form>
                    <div className="min-w-0 flex-1 py-1">
                      <p className="font-medium">{i.title}</p>
                      <p className="text-xs text-muted">
                        <Link className="underline" href={`/app/goals/${i.goal_id}`}>{goalTitle.get(i.goal_id)}</Link>
                        {i.due_date && i.due_date < today && <span className="font-semibold text-coral-ink"> · from {formatDay(i.due_date)}</span>}
                        {i.required && <span className="font-semibold"> · Required step</span>}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <section aria-labelledby="checkins" className="space-y-3">
            <h2 id="checkins" className="font-display text-xl font-bold">Check in</h2>
            {goals.map((g) => {
              const gc = checks.filter((c) => c.goal_id === g.id);
              const gf = fields.filter((f) => f.goal_id === g.id);
              const p = computeProgress({ goal: g, checkIns: gc, planItems: allPlan.filter((x) => x.goal_id === g.id), fields: gf });
              const todays = gc.find((c) => c.day === today);
              const missed = missedDays(gc, g.start_date, today);
              const area = areaInfo(g.area);
              return (
                <Card key={g.id} style={{ borderLeft: `6px solid ${area.accent}` }}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted"><span aria-hidden>{area.icon} </span>{area.label}</p>
                      <h3 className="font-display text-lg font-bold"><Link href={`/app/goals/${g.id}`} className="hover:underline">{g.title}</Link></h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <StatusPill status={p.status} />
                      <span className="text-muted">{p.percent}% · {p.streak}-day streak</span>
                    </div>
                  </div>
                  {todays && <p className="mb-2 text-sm text-muted">Logged today as <strong>{todays.status}</strong>. Tap to change.</p>}
                  {missed >= 2 && !todays && (
                    <div className="mb-3 rounded-xl bg-surface-2 p-3 text-sm">
                      <p className="font-semibold">Welcome back. {missed} days off changes nothing you already did.</p>
                      <ul className="mt-1 list-disc pl-5">{restartPlan(missed).slice(0, 3).map((r) => <li key={r}>{r}</li>)}</ul>
                    </div>
                  )}
                  <CheckInForm goalId={g.id} userId={user.id} fields={gf} trackingMode={g.tracking_mode} current={todays?.status} back="today" />
                </Card>
              );
            })}
          </section>
        </>
      )}

      <section aria-labelledby="shared" className="space-y-3">
        <h2 id="shared" className="font-display text-xl font-bold">Shared with me</h2>
        {shared.length === 0 ? (
          <p className="text-sm text-muted">When someone puts you in their corner, their goal shows up here, with only what they chose to share.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shared.map((s) => <li key={s.view.id}><SharedGoalCard view={s.view} owner={s.owner} /></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
