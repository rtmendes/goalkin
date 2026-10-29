import { cx } from "@/components/ui";
import { RING_LABEL } from "@/lib/visibility";
import type { Visibility } from "@/lib/types";

// Each ring has an icon and a word, so meaning never depends on colour alone.
export const RING_ICON: Record<Visibility, string> = { private: "🔒", chosen: "◐", circle: "◍", public: "◉" };
const RING_CLS: Record<Visibility, string> = {
  private: "bg-surface-2 text-ink",
  chosen: "bg-gold/20 text-gold-ink",
  circle: "bg-sage/15 text-sage-ink",
  public: "bg-coral/15 text-coral-ink",
};

export function RingBadge({ ring, className }: { ring: Visibility; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", RING_CLS[ring], className)}>
      <span aria-hidden>{RING_ICON[ring]}</span>
      {RING_LABEL[ring]}
    </span>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, [string, string]> = {
    Free: ["✓", "bg-sage/15 text-sage-ink"],
    Premium: ["★", "bg-gold/20 text-gold-ink"],
    Creator: ["✎", "bg-coral/15 text-coral-ink"],
    Custom: ["✦", "bg-surface-2 text-ink"],
  };
  const [icon, cls] = map[tier] ?? ["•", "bg-surface-2 text-ink"];
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>
      <span aria-hidden>{icon}</span>
      {tier}
    </span>
  );
}
