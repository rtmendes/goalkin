import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AssignmentRow, CheckInRow, ExperimentRow, GoalRow } from "@/lib/marketplace/metrics";

type Admin = ReturnType<typeof createAdminClient>;
const PAGE = 1000; // PostgREST's default max rows per request

/** Read a whole table slice in pages (capped), for admin metrics. */
async function all<T>(db: Admin, table: string, columns: string, maxPages = 50): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; p < maxPages; p++) {
    const { data, error } = await db.from(table).select(columns).range(p * PAGE, p * PAGE + PAGE - 1);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return out;
}

export async function loadMetricsData() {
  const db = createAdminClient();
  const [experiments, assignments, goals, checkIns] = await Promise.all([
    all<ExperimentRow>(db, "gk_experiments", "id, name, variants, active", 1),
    all<AssignmentRow>(db, "gk_experiment_assignments", "experiment_id, user_id, variant"),
    all<GoalRow>(db, "gk_goals", "owner_id, created_at, status"),
    all<CheckInRow>(db, "gk_check_ins", "user_id, day"),
  ]);
  return { experiments, assignments, goals, checkIns };
}
