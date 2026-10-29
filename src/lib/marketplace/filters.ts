// Marketplace browse filters. Pure so the page stays a Server Component and
// works without JavaScript (a plain GET form).

export interface Filterable {
  name: string;
  area: string;
  tier: string;
  summary: string;
}

export interface MarketFilters {
  area?: string;
  tier?: string;
  q?: string;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 80) || undefined;

export function readFilters(sp: Record<string, string | string[] | undefined>): MarketFilters {
  return { area: one(sp.area), tier: one(sp.tier), q: one(sp.q) };
}

export function filterListings<T extends Filterable>(items: T[], f: MarketFilters): T[] {
  const words = (f.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((t) => {
    if (f.area && t.area !== f.area) return false;
    if (f.tier && t.tier !== f.tier) return false;
    if (!words.length) return true;
    const hay = `${t.name} ${t.area} ${t.summary}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export function formatPrice(tier: string, price: number): string {
  if (tier === "Free") return "Free";
  if (price > 0) return `$${Number.isInteger(price) ? price : price.toFixed(2)}`;
  return tier === "Creator" ? "Set by creator" : "Price coming soon";
}
