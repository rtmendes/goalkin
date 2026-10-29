// "Partner went quiet" detection. Works only on the filtered SharedGoalView, so it
// never uses anything the owner did not choose to share.

import type { SharedGoalView } from "@/lib/visibility";

export const QUIET_AFTER_DAYS = 4;
const DAY = 86_400_000;

const dayStart = (s: string) => new Date(s.slice(0, 10) + "T00:00:00Z").getTime();

/**
 * Whole days since the latest check-in the viewer can see, or null when nothing is
 * visible (no check-ins yet, or the owner keeps check-ins private). Null never
 * triggers a nudge: we cannot tell "quiet" from "private".
 */
export function daysSinceLastCheckIn(recent: Pick<SharedGoalView["recent"][number], "day">[], today = new Date()): number | null {
  if (!recent.length) return null;
  const latest = recent.reduce((max, r) => (r.day > max ? r.day : max), recent[0].day);
  const diff = Math.floor((dayStart(today.toISOString()) - dayStart(latest)) / DAY);
  return Math.max(0, diff);
}

export function isQuiet(view: Pick<SharedGoalView, "recent"> | null, today = new Date(), threshold = QUIET_AFTER_DAYS): boolean {
  if (!view) return false;
  const days = daysSinceLastCheckIn(view.recent, today);
  return days !== null && days >= threshold;
}
