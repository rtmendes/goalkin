import { ProgressBar, StatusPill } from "@/components/ui";
import type { GoalPreview } from "@/lib/people/invites";

const fmt = (n: number | null | undefined, unit?: string | null) =>
  n === null || n === undefined ? "—" : `${Number.isInteger(n) ? n : n.toFixed(1)}${unit ? ` ${unit}` : ""}`;

const CHECK_WORD: Record<string, string> = { done: "✓ Done", partly: "◐ Partly", missed: "✗ Missed" };

/**
 * Renders an already-filtered view (SharedGoalView or a frozen invite preview).
 * It only shows what is present; nothing here reads raw goal data.
 */
export function SharedViewBody({ view, compact = false }: { view: GoalPreview; compact?: boolean }) {
  const shownSomething =
    view.status !== undefined || view.percent !== undefined || view.streak !== undefined || !!view.why || !!view.plan?.length || view.fields.length > 0 || view.recent.length > 0;
  return (
    <div className="space-y-3 text-sm">
      {(view.status || view.streak !== undefined) && (
        <div className="flex flex-wrap items-center gap-2">
          {view.status && <StatusPill status={view.status} />}
          {view.streak !== undefined && <span className="text-muted">Streak: <span className="font-semibold text-ink">{view.streak} day{view.streak === 1 ? "" : "s"}</span></span>}
        </div>
      )}
      {view.percent !== undefined && <ProgressBar value={view.percent} label={`${view.title}: complete`} />}
      {view.why && <p><span className="font-semibold">Why it matters:</span> {view.why}</p>}
      {view.fields.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {view.fields.map((f) => (
            <li key={f.label} className="rounded-xl bg-surface-2 px-3 py-2">
              <span className="block text-xs text-muted">{f.label}</span>
              <span className="font-semibold">{fmt(f.total ?? f.latest, f.unit)}</span>
              {f.target ? <span className="text-muted"> of {fmt(f.target, f.unit)}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {!compact && view.plan && view.plan.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">Plan ({view.plan.filter((p) => p.done).length} of {view.plan.length} done)</summary>
          <ul className="mt-1 space-y-1">
            {view.plan.slice(0, 20).map((p, i) => (
              <li key={i}><span aria-hidden>{p.done ? "✓" : "○"}</span> <span className="sr-only">{p.done ? "Done:" : "To do:"}</span> {p.title}</li>
            ))}
          </ul>
        </details>
      )}
      {view.recent.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted">Recent check-ins</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {view.recent.slice(0, compact ? 5 : 7).map((r) => (
              <li key={r.day} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">
                {r.day.slice(5)} · {CHECK_WORD[r.status] ?? r.status}
                {r.note ? <span className="block text-muted">“{r.note}”</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!shownSomething && <p className="text-muted">Only the title is shared so far.</p>}
      {view.hidden_count > 0 && (
        <p className="text-xs text-muted"><span aria-hidden>🔒</span> {view.hidden_count} item{view.hidden_count === 1 ? "" : "s"} kept private.</p>
      )}
    </div>
  );
}
