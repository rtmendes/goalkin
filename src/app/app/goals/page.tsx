import Link from "next/link";
import { ButtonLink, Empty, PageHeader, ProgressBar, StatusPill } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { computeProgress } from "@/lib/progress";
import { RING_LABEL } from "@/lib/visibility";
import { areaInfo, areaTint } from "@/lib/goals-core/areas";
import { formatDay } from "@/lib/goals-core/dates";
import type { CheckIn, Goal, GoalField, PlanItem } from "@/lib/types";

export const metadata = { title: "Goals" };

const ORDER: Goal["status"][] = ["active", "paused", "draft", "finished", "archived"];
const STATUS_WORD: Record<Goal["status"], string> = { active: "Active", paused: "Paused", draft: "Draft", finished: "Finished", archived: "Archived" };

export default async function GoalsPage() {
  const { supabase, user } = await requireUser("/app/goals");
  const { data } = await supabase.from("gk_goals").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
  const goals = (data ?? []) as Goal[];
  const ids = goals.map((g) => g.id);
  const [checks, items, fields] = ids.length
    ? await Promise.all([
        supabase.from("gk_check_ins").select("goal_id, day, status, values").in("goal_id", ids),
        supabase.from("gk_plan_items").select("goal_id, done, kind, due_date").in("goal_id", ids),
        supabase.from("gk_goal_fields").select("goal_id, key, target, kind").in("goal_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const sorted = [...goals].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  return (
    <div>
      <PageHeader title="Your goals" sub="Everything here is private unless you chose otherwise."
        action={<ButtonLink href="/app/goals/new"><span aria-hidden>＋</span> New goal</ButtonLink>} />
      {sorted.length === 0 ? (
        <Empty title="No goals yet">
          <p>Start with a three-minute setup and we’ll draft a plan you can edit.</p>
          <div className="mt-3"><ButtonLink href="/onboarding">Set up my first goal</ButtonLink></div>
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {sorted.map((g) => {
            const p = computeProgress({
              goal: g,
              checkIns: ((checks.data ?? []) as (Pick<CheckIn, "day" | "status" | "values"> & { goal_id: string })[]).filter((c) => c.goal_id === g.id),
              planItems: ((items.data ?? []) as (Pick<PlanItem, "done" | "kind" | "due_date"> & { goal_id: string })[]).filter((i) => i.goal_id === g.id),
              fields: ((fields.data ?? []) as (Pick<GoalField, "key" | "target" | "kind"> & { goal_id: string })[]).filter((f) => f.goal_id === g.id),
            });
            const area = areaInfo(g.area);
            return (
              <li key={g.id}>
                <Link href={`/app/goals/${g.id}`} className="block rounded-2xl border p-4 transition hover:shadow-md" style={areaTint(area.accent, 7)}>
                  <p className="text-xs font-semibold text-muted"><span aria-hidden>{area.icon} </span>{area.label}</p>
                  <h2 className="mt-1 font-display text-lg font-bold">{g.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 font-semibold">{STATUS_WORD[g.status]}</span>
                    {g.status === "active" && <StatusPill status={p.status} />}
                    <span className="text-muted">{RING_LABEL[g.visibility]}</span>
                    {g.finish_date && <span className="text-muted">· by {formatDay(g.finish_date)}</span>}
                  </div>
                  <div className="mt-3"><ProgressBar value={p.percent} label={`${p.streak}-day streak`} /></div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
