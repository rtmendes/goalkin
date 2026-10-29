// The single gate for anything one person sees of another person's goal.
// Rings widen outward: private < chosen < circle < public. A value set to a ring
// is visible to that ring and every narrower one (a "circle" value is also seen
// by chosen people). The owner always sees everything.

import type { CheckIn, Goal, GoalField, SummaryVisibility, Visibility, PlanItem } from "@/lib/types";
import { computeProgress } from "@/lib/progress";

export const RINGS: Visibility[] = ["private", "chosen", "circle", "public"];
export const RING_LABEL: Record<Visibility, string> = {
  private: "Only me",
  chosen: "Chosen people",
  circle: "Circle",
  public: "Public",
};

export type Audience = "owner" | Exclude<Visibility, "private"> | "none";

const rank = (v: Visibility) => RINGS.indexOf(v);

/** Can a viewer in `audience` see something set to `level`? */
export function canSee(level: Visibility, audience: Audience): boolean {
  if (audience === "owner") return true;
  if (audience === "none") return false;
  return level !== "private" && rank(audience) <= rank(level);
}

/** Work out which ring a viewer is in for a goal. */
export function audienceFor(args: {
  goal: Pick<Goal, "owner_id" | "visibility" | "circle_id">;
  viewerId: string | null;
  isChosen: boolean;
  isCircleMember: boolean;
}): Audience {
  const { goal, viewerId, isChosen, isCircleMember } = args;
  if (viewerId && viewerId === goal.owner_id) return "owner";
  let ring: Audience = "public";
  if (isCircleMember && goal.circle_id) ring = "circle";
  if (isChosen) ring = "chosen";
  // The goal card itself must reach this ring, or the viewer sees nothing.
  if (ring === "public" && goal.visibility !== "public") return "none";
  if (!canSee(goal.visibility, ring)) return "none";
  return ring;
}

export const DEFAULT_SUMMARY_VISIBILITY: Omit<SummaryVisibility, "goal_id"> = {
  status: "private",
  percent: "private",
  streak: "private",
  plan: "private",
  why: "private",
  check_in_notes: "private",
  photos: "private",
};

export interface SharedGoalView {
  id: string;
  title: string;
  area: string | null;
  finish_date: string | null;
  audience: Audience;
  status?: "on_track" | "behind" | "finished" | "not_started";
  percent?: number;
  streak?: number;
  why?: string | null;
  plan?: Pick<PlanItem, "title" | "week" | "due_date" | "done" | "kind">[];
  fields: { key: string; label: string; unit: string | null; kind: GoalField["kind"]; latest: number | null; total: number | null; target: number | null }[];
  recent: { day: string; status: CheckIn["status"]; note?: string | null; photo_url?: string | null }[];
  hidden_count: number;
}

/**
 * Build exactly what `audience` may see. Anything not explicitly allowed is
 * dropped, and `hidden_count` tells the viewer that some items stay private
 * without revealing what they are.
 */
export function buildSharedView(input: {
  goal: Goal;
  fields: GoalField[];
  summary: Omit<SummaryVisibility, "goal_id"> | null;
  checkIns: CheckIn[];
  planItems: PlanItem[];
  audience: Audience;
  today?: Date;
}): SharedGoalView | null {
  const { goal, fields, checkIns, planItems, audience } = input;
  if (audience === "none") return null;
  const summary = input.summary ?? DEFAULT_SUMMARY_VISIBILITY;
  const progress = computeProgress({ goal, checkIns, planItems, fields, today: input.today });
  let hidden = 0;
  const allow = (level: Visibility) => {
    const ok = canSee(level, audience);
    if (!ok) hidden++;
    return ok;
  };

  const view: SharedGoalView = {
    id: goal.id,
    title: goal.title,
    area: goal.area,
    finish_date: goal.finish_date,
    audience,
    fields: [],
    recent: [],
    hidden_count: 0,
  };
  if (allow(summary.status)) view.status = progress.status;
  if (allow(summary.percent)) view.percent = progress.percent;
  if (allow(summary.streak)) view.streak = progress.streak;
  if (allow(summary.why)) view.why = goal.why;
  if (allow(summary.plan)) {
    view.plan = planItems
      .filter((p) => p.kind !== "guardrail")
      .map(({ title, week, due_date, done, kind }) => ({ title, week, due_date, done, kind }));
  }
  const notesOk = canSee(summary.check_in_notes, audience);
  const photosOk = canSee(summary.photos, audience);
  if (!notesOk) hidden++;
  if (!photosOk) hidden++;
  const showStatus = canSee(summary.status, audience);
  if (showStatus || notesOk || photosOk) {
    view.recent = [...checkIns]
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, 7)
      .map((c) => ({
        day: c.day,
        status: c.status,
        ...(notesOk ? { note: c.note } : {}),
        ...(photosOk ? { photo_url: c.photo_url } : {}),
      }));
  }
  for (const f of [...fields].sort((a, b) => a.sort - b.sort)) {
    if (!allow(f.visibility)) continue;
    const series = checkIns
      .filter((c) => typeof c.values?.[f.key] === "number")
      .sort((a, b) => a.day.localeCompare(b.day));
    const latest = series.length ? series[series.length - 1].values[f.key] : null;
    const total = series.length ? series.reduce((s, c) => s + c.values[f.key], 0) : null;
    view.fields.push({ key: f.key, label: f.label, unit: f.unit, kind: f.kind, latest, total, target: f.target });
  }
  view.hidden_count = hidden;
  return view;
}
