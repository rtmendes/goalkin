import { REACTIONS } from "@/lib/people/invites";

/** One-tap reactions. Each button carries its word, never the emoji alone. */
export function ReactionRow({ action, toId, toName }: { action: (fd: FormData) => Promise<void>; toId?: string; toName?: string }) {
  return (
    <form action={action} className="flex flex-wrap gap-1.5" aria-label={toName ? `React to ${toName}` : "React to the circle"}>
      {toId && <input type="hidden" name="to_id" value={toId} />}
      {REACTIONS.map((r, i) => (
        <button
          key={r.label}
          type="submit"
          name="reaction"
          value={i}
          className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface px-3 text-sm hover:bg-surface-2"
        >
          <span aria-hidden>{r.emoji}</span>
          {r.label}
        </button>
      ))}
    </form>
  );
}
