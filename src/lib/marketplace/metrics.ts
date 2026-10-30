// Admin metrics as pure functions over plain rows, so they are easy to test and
// can run on whatever slice of data the admin page loads.
//
// Week-4 check-in rate (the north-star retention metric): among people whose
// first goal is at least 28 days old, the share with at least one check-in on
// days 22 to 28 after that goal was created. The creation day is day 1.

const DAY = 86_400_000;
const dayNumber = (isoDay: string) => Math.floor(new Date(isoDay.slice(0, 10) + "T00:00:00Z").getTime() / DAY);
const utcDay = (ts: string) => new Date(ts).toISOString().slice(0, 10);

export interface GoalRow { owner_id: string; created_at: string; status: string }
export interface CheckInRow { user_id: string; day: string }
export interface AssignmentRow { experiment_id: string; user_id: string; variant: string }
export interface ExperimentRow { id: string; name: string; variants: { key: string; weight?: number }[]; active: boolean }

export interface Retention { eligible: number; retained: number; rate: number | null }

/** Earliest goal creation day per person (YYYY-MM-DD, UTC). */
export function firstGoalDay(goals: GoalRow[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const g of goals) {
    const d = utcDay(g.created_at);
    const cur = out.get(g.owner_id);
    if (!cur || d < cur) out.set(g.owner_id, d);
  }
  return out;
}

/** Has the person's 28-day window fully passed? */
export function isWeek4Eligible(firstDay: string, now: Date): boolean {
  return dayNumber(utcDay(now.toISOString())) - dayNumber(firstDay) >= 28;
}

/** Any check-in on days 22-28 (offsets 21-27 from the first goal's day). */
export function checkedInWeek4(firstDay: string, checkInDays: string[]): boolean {
  const start = dayNumber(firstDay);
  return checkInDays.some((d) => {
    const off = dayNumber(d) - start;
    return off >= 21 && off <= 27;
  });
}

function checkInsByUser(checkIns: CheckInRow[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const c of checkIns) {
    const list = m.get(c.user_id);
    if (list) list.push(c.day);
    else m.set(c.user_id, [c.day]);
  }
  return m;
}

export function week4Retention(input: { goals: GoalRow[]; checkIns: CheckInRow[]; now: Date; userIds?: Iterable<string> }): Retention {
  const first = firstGoalDay(input.goals);
  const byUser = checkInsByUser(input.checkIns);
  const users = input.userIds ? new Set(input.userIds) : new Set(first.keys());
  let eligible = 0;
  let retained = 0;
  for (const u of users) {
    const fd = first.get(u);
    if (!fd || !isWeek4Eligible(fd, input.now)) continue;
    eligible++;
    if (checkedInWeek4(fd, byUser.get(u) ?? [])) retained++;
  }
  return { eligible, retained, rate: eligible ? retained / eligible : null };
}

export interface VariantStats extends Retention {
  key: string;
  assigned: number;
  goalsFinished: number;
}

export interface ExperimentStats {
  id: string;
  name: string;
  active: boolean;
  variants: VariantStats[];
}

export function experimentReport(input: {
  experiments: ExperimentRow[];
  assignments: AssignmentRow[];
  goals: GoalRow[];
  checkIns: CheckInRow[];
  now: Date;
}): ExperimentStats[] {
  const finishedByUser = new Map<string, number>();
  for (const g of input.goals) if (g.status === "finished") finishedByUser.set(g.owner_id, (finishedByUser.get(g.owner_id) ?? 0) + 1);

  return input.experiments.map((exp) => {
    const mine = input.assignments.filter((a) => a.experiment_id === exp.id);
    // Variants that only exist in assignments (renamed later) still show up.
    const keys = [...new Set([...(exp.variants ?? []).map((v) => v.key), ...mine.map((a) => a.variant)])];
    const variants = keys.map((key) => {
      const users = mine.filter((a) => a.variant === key).map((a) => a.user_id);
      const r = week4Retention({ goals: input.goals, checkIns: input.checkIns, now: input.now, userIds: users });
      return { key, assigned: users.length, goalsFinished: users.reduce((s, u) => s + (finishedByUser.get(u) ?? 0), 0), ...r };
    });
    return { id: exp.id, name: exp.name, active: exp.active, variants };
  });
}

export const pct = (r: number | null) => (r == null ? "n/a" : `${Math.round(r * 1000) / 10}%`);

/** Gross sales and creator share totals for a list of purchases. */
export function salesTotals(rows: { amount: number | string | null; creator_share: number | string | null }[]) {
  const gross = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const share = rows.reduce((s, r) => s + (Number(r.creator_share) || 0), 0);
  return { count: rows.length, gross: Math.round(gross * 100) / 100, creatorShare: Math.round(share * 100) / 100 };
}
