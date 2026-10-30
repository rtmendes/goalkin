"use client";
import { useFormStatus } from "react-dom";
import { saveCheckIn } from "@/lib/goals-core/actions/goal";
import { inputCls } from "@/components/ui";
import { MediaUpload } from "@/components/goals/media-upload";
import type { CheckInStatus, GoalField, TrackingMode } from "@/lib/types";

const OPTIONS: { status: CheckInStatus; icon: string; label: string; cls: string }[] = [
  { status: "done", icon: "✓", label: "Done", cls: "bg-sage text-white" },
  { status: "partly", icon: "◐", label: "Partly", cls: "border border-line bg-surface-2 text-ink" },
  { status: "missed", icon: "○", label: "Missed", cls: "border border-line bg-surface text-ink" },
];

function StatusButtons({ current }: { current?: CheckInStatus | null }) {
  const { pending } = useFormStatus();
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="How did today go?">
      {OPTIONS.map((o) => (
        <button key={o.status} type="submit" name="status" value={o.status} disabled={pending} aria-pressed={current === o.status}
          className={`min-h-11 rounded-xl px-2 text-sm font-semibold transition disabled:opacity-60 ${o.cls} ${current === o.status ? "ring-2 ring-gold" : ""}`}>
          <span aria-hidden>{o.icon} </span>{o.label}
        </button>
      ))}
    </div>
  );
}

/** One tap records the day; the details (note, numbers, photo) are optional and sent with the same tap. */
export function CheckInForm({
  goalId, userId, fields, trackingMode, current, back, day,
}: {
  goalId: string;
  userId: string;
  fields: Pick<GoalField, "key" | "label" | "kind" | "unit">[];
  trackingMode: TrackingMode;
  current?: CheckInStatus | null;
  back?: "today";
  day?: string;
}) {
  const numeric = fields.filter((f) => f.kind !== "note" && f.kind !== "photo");
  return (
    <form action={saveCheckIn} className="space-y-3">
      <input type="hidden" name="goalId" value={goalId} />
      {back && <input type="hidden" name="back" value={back} />}
      {day && <input type="hidden" name="day" value={day} />}
      <StatusButtons current={current} />
      <details className="rounded-xl border border-line px-3">
        <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-semibold">Add a note{trackingMode === "detailed" && numeric.length ? ", numbers" : ""} or photo</summary>
        <div className="space-y-3 pb-3">
          {trackingMode === "detailed" && numeric.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-sm font-semibold">{f.label}{f.unit ? ` (${f.unit})` : ""}</span>
              {f.kind === "yes_no" ? (
                <select name={`v_${f.key}`} className={inputCls} defaultValue="">
                  <option value="">Skip</option><option value="yes">Yes</option><option value="no">No</option>
                </select>
              ) : (
                <input name={`v_${f.key}`} type="number" inputMode="decimal" step="any" min={f.kind === "rating" ? 1 : undefined} max={f.kind === "rating" ? 5 : undefined} className={inputCls} />
              )}
            </label>
          ))}
          {trackingMode === "simple" && (
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Rate the day (1 to 5, optional)</span>
              <input name="rating" type="number" min={1} max={5} inputMode="numeric" className={inputCls} />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{trackingMode === "reflective" ? "What moved you forward?" : "Note (optional)"}</span>
            <textarea name="note" maxLength={1000} className={`${inputCls} min-h-20`} />
          </label>
          <MediaUpload userId={userId} folder="checkins" name="photoPath" label="Photo (optional, private)" accept="image/*" />
          <p className="text-xs text-muted">Then tap Done, Partly or Missed above to save everything.</p>
        </div>
      </details>
    </form>
  );
}
