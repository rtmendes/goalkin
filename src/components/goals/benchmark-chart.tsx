import type { WeekPoint } from "@/lib/goals-core/dates";

/**
 * Weekly bars with benchmark markers. The SVG is a summary picture; the table
 * below it carries the same numbers for screen readers and zoomed views.
 */
export function BenchmarkChart({ points, label, unit }: { points: WeekPoint[]; label: string; unit?: string | null }) {
  if (!points.length) return null;
  const W = 320, H = 140, pad = 24;
  const max = Math.max(1, ...points.map((p) => p.value));
  const bw = (W - pad * 2) / points.length;
  const summary = `${label} by week, weeks ${points[0].week} to ${points[points.length - 1].week}. Highest week: ${max}${unit ? " " + unit : ""}.`;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-auto w-full max-w-xl text-ink">
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--line)" strokeWidth="1" />
        {points.map((p, i) => {
          const h = ((H - pad * 2) * p.value) / max;
          const x = pad + i * bw + bw * 0.15;
          const y = H - pad - h;
          const hit = p.benchmarks > 0 && p.benchmarksDone === p.benchmarks;
          return (
            <g key={p.week}>
              <rect x={x} y={y} width={bw * 0.7} height={Math.max(h, 1)} rx="3" fill="var(--sage)" />
              {p.benchmarks > 0 && (
                <text x={x + bw * 0.35} y={Math.max(12, y - 4)} textAnchor="middle" fontSize="11" fill={hit ? "var(--gold-ink)" : "var(--muted)"}>{hit ? "★" : "☆"}</text>
              )}
              {(points.length <= 12 || i % 2 === 0) && (
                <text x={x + bw * 0.35} y={H - pad + 14} textAnchor="middle" fontSize="10" fill="var(--muted)">W{p.week}</text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-muted">Bars: {label.toLowerCase()} per week. ★ benchmark met, ☆ benchmark still open.</figcaption>
      <details className="mt-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">Show as a table</summary>
        <table className="w-full text-left">
          <caption className="sr-only">{summary}</caption>
          <thead><tr className="text-muted"><th scope="col" className="py-1 pr-3">Week</th><th scope="col" className="py-1 pr-3">{label}{unit ? ` (${unit})` : ""}</th><th scope="col" className="py-1">Benchmarks</th></tr></thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.week} className="border-t border-line">
                <th scope="row" className="py-1 pr-3 font-normal">Week {p.week}</th>
                <td className="py-1 pr-3">{p.value}</td>
                <td className="py-1">{p.benchmarks ? `${p.benchmarksDone} of ${p.benchmarks} met` : "None due"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
