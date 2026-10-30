import { StatusPill, cx } from "@/components/ui";
import { areaInfo, areaTint } from "@/lib/goals-core/areas";
import { formatDay } from "@/lib/goals-core/dates";
import type { SharedGoalView } from "@/lib/visibility";

const STATUS_WORD = { done: ["✓", "Done"], partly: ["◐", "Partly"], missed: ["○", "Missed"] } as const;

const fmt = (n: number | null, unit: string | null, kind: string) => {
  if (n === null) return "—";
  if (kind === "money") return `$${n.toLocaleString("en-US")}`;
  if (kind === "percent") return `${n}%`;
  return `${n.toLocaleString("en-US")}${unit ? ` ${unit}` : ""}`;
};

/**
 * Renders a SharedGoalView and nothing else, so what appears here is exactly
 * what the privacy gate allowed. Used for previews, shared-with-me and public pages.
 */
export function SharedGoalCard({ view, owner, className, headingLevel = 3 }: { view: SharedGoalView; owner?: string; className?: string; headingLevel?: 2 | 3 }) {
  const area = areaInfo(view.area);
  const H = headingLevel === 2 ? "h2" : "h3";
  const nothingShown = view.status === undefined && view.percent === undefined && view.streak === undefined && !view.why && !view.plan && !view.fields.length && !view.recent.length;
  return (
    <article className={cx("rounded-2xl border bg-surface p-4", className)} style={areaTint(area.accent, 8)}>
      <p className="text-xs font-semibold text-muted"><span aria-hidden>{area.icon} </span>{area.label}{owner ? ` · ${owner}` : ""}</p>
      <H className="mt-1 font-display text-xl font-bold">{view.title}</H>
      {view.finish_date && <p className="text-sm text-muted">Finish by {formatDay(view.finish_date, { month: "long", day: "numeric", year: "numeric" })}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {view.status && <StatusPill status={view.status} />}
        {view.streak !== undefined && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold">{view.streak}-day streak</span>}
      </div>
      {view.percent !== undefined && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted"><span>Progress</span><span>{view.percent}%</span></div>
          <div role="progressbar" aria-label="Progress" aria-valuenow={view.percent} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-sage" style={{ width: `${view.percent}%` }} />
          </div>
        </div>
      )}
      {view.why && <p className="mt-3 text-sm"><span className="font-semibold">Why it matters: </span>{view.why}</p>}
      {view.fields.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {view.fields.map((f) => (
            <div key={f.key} className="rounded-xl bg-surface-2 px-3 py-2">
              <dt className="text-xs text-muted">{f.label}</dt>
              <dd className="font-semibold">
                {f.kind === "percent" ? fmt(f.latest, f.unit, f.kind) : fmt(f.total, f.unit, f.kind)}
                {f.target ? <span className="font-normal text-muted"> of {fmt(f.target, f.unit, f.kind)}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {view.recent.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-muted">Recent check-ins</p>
          <ul className="mt-1 space-y-1 text-sm">
            {view.recent.map((r) => (
              <li key={r.day} className="flex flex-wrap gap-x-2">
                <span className="text-muted">{formatDay(r.day)}</span>
                <span><span aria-hidden>{STATUS_WORD[r.status][0]} </span>{STATUS_WORD[r.status][1]}</span>
                {r.note && <span className="text-muted">“{r.note}”</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {view.plan && view.plan.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">Plan ({view.plan.filter((p) => p.done).length} of {view.plan.length} done)</summary>
          <ul className="space-y-1">
            {view.plan.slice(0, 40).map((p, i) => (
              <li key={i}><span aria-hidden>{p.done ? "✓ " : "○ "}</span><span className="sr-only">{p.done ? "Done: " : "To do: "}</span>Week {p.week}: {p.title}</li>
            ))}
          </ul>
        </details>
      )}
      {nothingShown && <p className="mt-3 text-sm text-muted">Only the goal title is shared.</p>}
      {view.hidden_count > 0 && <p className="mt-3 text-xs text-muted"><span aria-hidden>🔒 </span>{view.hidden_count} item{view.hidden_count === 1 ? "" : "s"} kept private.</p>}
    </article>
  );
}
