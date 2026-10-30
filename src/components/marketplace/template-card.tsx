import Link from "next/link";
import { TierBadge } from "@/components/marketplace/ring-badge";
import { formatPrice } from "@/lib/marketplace/filters";
import type { Listing } from "@/lib/templates";

export function TemplateCard({ t, creatorName }: { t: Listing; creatorName?: string | null }) {
  return (
    <article className="relative flex h-full flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm hover:border-sage focus-within:border-sage">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TierBadge tier={t.tier} />
        <span className="text-xs text-muted">{t.duration ?? "Flexible length"}</span>
      </div>
      <h3 className="mt-2 text-lg font-semibold">
        {/* The whole card is clickable through this link's ::after overlay. */}
        <Link href={`/marketplace/${t.id}`} className="after:absolute after:inset-0 after:content-['']">{t.name}</Link>
      </h3>
      <p className="text-xs text-muted">{t.area}{creatorName ? ` · by ${creatorName}` : ""}</p>
      <p className="mt-2 flex-1 text-sm text-muted">{t.summary}</p>
      <p className="mt-3 font-semibold">{formatPrice(t.tier, t.price)}</p>
    </article>
  );
}
