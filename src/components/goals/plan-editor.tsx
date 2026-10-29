import Link from "next/link";
import { Button, inputCls } from "@/components/ui";
import { addItem, deleteItem, regeneratePlan, toggleItemDone, updateItem } from "@/lib/goals-core/actions/goal";
import { formatDay, weekOf } from "@/lib/goals-core/dates";
import type { PlanItem } from "@/lib/types";

const SOURCE: Record<PlanItem["source"], string> = { ai: "AI suggestion", template: "From template", person: "Yours" };
const KIND: Partial<Record<PlanItem["kind"], string>> = {
  benchmark: "Benchmark", guardrail: "Required step", milestone: "Milestone", reward: "Reward", gather: "Gather first", checkin: "Check-in", session: "Session",
};

function Item({ item, goalId }: { item: PlanItem; goalId: string }) {
  return (
    <li className="rounded-xl border border-line bg-surface p-2">
      <div className="flex items-start gap-2">
        <form action={toggleItemDone}>
          <input type="hidden" name="goalId" value={goalId} />
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="done" value={String(!item.done)} />
          <button aria-label={item.done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`} aria-pressed={item.done}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg ${item.done ? "border-sage bg-sage text-white" : "border-line bg-surface"}`}>
            <span aria-hidden>{item.done ? "✓" : ""}</span>
          </button>
        </form>
        <div className="min-w-0 flex-1 py-1">
          <p className={`font-medium ${item.done ? "text-muted line-through" : ""}`}>{item.title}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
            {item.due_date && <span>{formatDay(item.due_date)}</span>}
            {KIND[item.kind] && <span className={item.required ? "font-semibold text-coral-ink" : ""}>{KIND[item.kind]}</span>}
            <span>{SOURCE[item.source]}</span>
            {item.notes && <span>· {item.notes}</span>}
          </p>
        </div>
      </div>
      <details className="mt-1 pl-13">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-muted">Edit</summary>
        <form action={updateItem} className="grid gap-2 pb-2 sm:grid-cols-2">
          <input type="hidden" name="goalId" value={goalId} />
          <input type="hidden" name="itemId" value={item.id} />
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold">Title{item.required ? " (required steps keep their wording)" : ""}</span>
            <input name="title" defaultValue={item.title} readOnly={item.required} maxLength={140} className={inputCls} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold">Date</span>
            <input name="due_date" type="date" defaultValue={item.due_date ?? ""} className={inputCls} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold">Notes</span>
            <input name="notes" defaultValue={item.notes ?? ""} maxLength={500} className={inputCls} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" variant="secondary">Save</Button>
          </div>
        </form>
        {item.required ? (
          <p className="pb-2 text-xs text-muted">This safety step can be completed but not removed.</p>
        ) : (
          <form action={deleteItem} className="pb-2">
            <input type="hidden" name="goalId" value={goalId} />
            <input type="hidden" name="itemId" value={item.id} />
            <button className="min-h-11 rounded-xl px-3 text-sm font-semibold text-coral-ink underline">Remove this step</button>
          </form>
        )}
      </details>
    </li>
  );
}

export function PlanEditor({ goalId, startDate, items, today, canRegenerate }: { goalId: string; startDate: string; items: PlanItem[]; today: string; canRegenerate: boolean }) {
  const thisWeek = weekOf(startDate, today);
  const weeks = [...new Set(items.map((i) => i.week))].sort((a, b) => a - b);
  return (
    <div className="space-y-3">
      {weeks.length === 0 && <p className="text-sm text-muted">No plan items yet. Add your first step below.</p>}
      {weeks.map((w) => {
        const these = items.filter((i) => i.week === w).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "") || a.sort - b.sort);
        const done = these.filter((i) => i.done).length;
        return (
          <details key={w} open={w === thisWeek || (w === 1 && thisWeek < 1)} className="rounded-2xl border border-line bg-surface-2 px-3">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 py-2 font-semibold">
              <span>Week {w}{w === thisWeek ? " · this week" : ""}</span>
              <span className="text-xs font-normal text-muted">{done} of {these.length} done</span>
            </summary>
            <ul className="space-y-2 pb-3">{these.map((i) => <Item key={i.id} item={i} goalId={goalId} />)}</ul>
          </details>
        );
      })}

      <form action={addItem} className="grid gap-2 rounded-2xl border border-dashed border-line p-3 sm:grid-cols-[1fr_auto_auto]">
        <input type="hidden" name="goalId" value={goalId} />
        <label className="min-w-0">
          <span className="mb-1 block text-sm font-semibold">Add your own step</span>
          <input name="title" required maxLength={140} className={inputCls} placeholder="e.g. Lay out clothes the night before" />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">Date</span>
          <input name="due_date" type="date" defaultValue={today} className={inputCls} />
        </label>
        <div className="flex items-end"><Button type="submit" className="w-full">Add</Button></div>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        {canRegenerate ? (
          <form action={regeneratePlan}>
            <input type="hidden" name="goalId" value={goalId} />
            <Button type="submit" variant="secondary">Redraft upcoming steps with AI</Button>
          </form>
        ) : (
          <p className="text-sm text-muted">Want the AI to redraft your upcoming steps? <Link href="/pricing" className="underline">That’s part of Pro.</Link></p>
        )}
        <p className="text-xs text-muted">Redrafting keeps your own steps, finished steps and required safety steps.</p>
      </div>
    </div>
  );
}
