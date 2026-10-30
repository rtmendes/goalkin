import { cx } from "@/components/ui";

const MAP: Record<string, [string, string, string]> = {
  draft: ["✎", "Draft", "bg-surface-2 text-ink"],
  in_review: ["⏳", "In review", "bg-gold/20 text-gold-ink"],
  published: ["✓", "Published", "bg-sage/15 text-sage-ink"],
  rejected: ["✕", "Not accepted", "bg-coral/15 text-coral-ink"],
  archived: ["▢", "Archived", "bg-surface-2 text-muted"],
  applied: ["⏳", "Applied", "bg-gold/20 text-gold-ink"],
  approved: ["✓", "Approved", "bg-sage/15 text-sage-ink"],
  paused: ["Ⅱ", "Paused", "bg-surface-2 text-muted"],
  changes_requested: ["↺", "Changes requested", "bg-gold/20 text-gold-ink"],
};

/** Status with an icon and a word (never colour alone). */
export function StatusTag({ status }: { status: string }) {
  const [icon, label, cls] = MAP[status] ?? ["•", status, "bg-surface-2 text-ink"];
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}
