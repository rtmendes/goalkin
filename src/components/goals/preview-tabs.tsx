"use client";
import { useId, useState } from "react";
import { buildSharedView, canSee, RING_LABEL } from "@/lib/visibility";
import { SharedGoalCard } from "@/components/goals/shared-goal-card";
import type { CheckIn, Goal, GoalField, PlanItem, SummaryVisibility } from "@/lib/types";

type Ring = "chosen" | "circle" | "public";
const TABS: Ring[] = ["chosen", "circle", "public"];
const WHO: Record<Ring, string> = { chosen: "People you picked", circle: "Your circle", public: "Anyone with the link" };

/** Live preview per ring, built with the same privacy gate the server uses. */
export function PreviewTabs({
  goal, fields, summary, checkIns, planItems, note,
}: {
  goal: Goal;
  fields: GoalField[];
  summary: Omit<SummaryVisibility, "goal_id">;
  checkIns: CheckIn[];
  planItems: PlanItem[];
  note?: string;
}) {
  const [tab, setTab] = useState<Ring>("chosen");
  const base = useId();
  const reaches = canSee(goal.visibility, tab);
  const view = reaches ? buildSharedView({ goal, fields, summary, checkIns, planItems, audience: tab }) : null;
  return (
    <section aria-label="Preview of what others see" className="rounded-2xl border border-line bg-surface-2 p-3">
      <p className="mb-2 text-sm font-semibold">Preview: what they see</p>
      <div role="tablist" aria-label="Who is looking" className="mb-3 grid grid-cols-3 gap-1">
        {TABS.map((t) => (
          <button key={t} role="tab" type="button" id={`${base}-${t}`} aria-selected={tab === t} aria-controls={`${base}-panel`} onClick={() => setTab(t)}
            className={`min-h-11 rounded-xl px-2 text-xs font-semibold ${tab === t ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>
            {RING_LABEL[t]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${tab}`} aria-live="polite">
        <p className="mb-2 text-xs text-muted">{WHO[tab]}{note ? ` · ${note}` : ""}</p>
        {view ? (
          <SharedGoalCard view={view} />
        ) : (
          <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm">
            <span aria-hidden>🔒 </span>Nothing. Your goal is set to <strong>{RING_LABEL[goal.visibility]}</strong>, so {WHO[tab].toLowerCase()} can’t see it at all.
          </p>
        )}
      </div>
    </section>
  );
}
