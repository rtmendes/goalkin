"use client";
import { SLOT_DAYS, SLOT_PARTS } from "@/lib/goals-core/rules";

const DAY_LABEL: Record<(typeof SLOT_DAYS)[number], [string, string]> = {
  mon: ["M", "Monday"], tue: ["T", "Tuesday"], wed: ["W", "Wednesday"], thu: ["T", "Thursday"], fri: ["F", "Friday"], sat: ["S", "Saturday"], sun: ["S", "Sunday"],
};
const PART_LABEL: Record<(typeof SLOT_PARTS)[number], [string, string]> = { morning: ["☀", "Morning"], midday: ["◑", "Midday"], evening: ["☾", "Evening"] };

/** Mini week: tap the slots that are open. Each cell is a toggle button with a full spoken label. */
export function WeekGrid({ value, onChange, label }: { value: string[]; onChange: (v: string[]) => void; label: string }) {
  const set = new Set(value);
  const toggle = (k: string) => {
    const next = new Set(set);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange([...next]);
  };
  return (
    <div role="group" aria-label={label} className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-center text-xs">
        <thead>
          <tr>
            <td />
            {SLOT_DAYS.map((d) => <th key={d} scope="col" className="font-semibold"><abbr title={DAY_LABEL[d][1]} className="no-underline">{DAY_LABEL[d][0]}</abbr></th>)}
          </tr>
        </thead>
        <tbody>
          {SLOT_PARTS.map((p) => (
            <tr key={p}>
              <th scope="row" className="pr-1 text-left font-semibold"><span aria-hidden>{PART_LABEL[p][0]} </span><span className="hidden sm:inline">{PART_LABEL[p][1]}</span><span className="sr-only sm:hidden">{PART_LABEL[p][1]}</span></th>
              {SLOT_DAYS.map((d) => {
                const k = `${d}-${p}`;
                const on = set.has(k);
                return (
                  <td key={k}>
                    <button type="button" aria-pressed={on} aria-label={`${DAY_LABEL[d][1]} ${PART_LABEL[p][1].toLowerCase()}`} onClick={() => toggle(k)}
                      className={`h-11 w-full min-w-9 rounded-lg border text-base transition ${on ? "border-sage bg-sage text-white" : "border-line bg-surface hover:bg-surface-2"}`}>
                      <span aria-hidden>{on ? "✓" : ""}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-muted" aria-live="polite">{value.length ? `${value.length} slot${value.length === 1 ? "" : "s"} open, about ${value.length * 30} minutes a week.` : "No slots picked yet."}</p>
    </div>
  );
}
