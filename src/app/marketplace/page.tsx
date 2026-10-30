import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/site-shell";
import { TemplateCard } from "@/components/marketplace/template-card";
import { Button, Empty, Field, Input, Select } from "@/components/ui";
import { listTemplates } from "@/lib/templates";
import { AREAS } from "@/lib/marketplace/template-schema";
import { filterListings, readFilters } from "@/lib/marketplace/filters";
import { creatorNames } from "@/lib/marketplace/creators";
import { PROGRAMS } from "@/lib/commerce/products";

export const metadata: Metadata = {
  title: "Templates",
  description: "Free starter templates, premium programs and creator plans. Each one is fitted to your dates, your week and your people.",
};

const TIERS = [
  { id: "Free", label: "Free" },
  { id: "Premium", label: "Premium" },
  { id: "Creator", label: "Creator" },
];

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = readFilters(await searchParams);
  const all = await listTemplates().catch(() => []);
  const items = filterListings(all, filters);
  const names = await creatorNames(items.map((i) => i.creator_id));
  const filtered = !!(filters.area || filters.tier || filters.q);

  return (
    <SiteShell>
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Start from a plan someone already proved</h1>
        <p className="mt-2 text-muted">Pick a template, answer a few questions, and the plan is fitted to your dates and your week. You can edit every step.</p>
      </header>

      <section aria-labelledby="season" className="mt-6 rounded-2xl border border-line bg-surface-2 p-4">
        <h2 id="season" className="font-semibold"><span aria-hidden>★ </span>Seasonal programs</h2>
        <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {Object.entries(PROGRAMS).map(([id, p]) => (
            <li key={id}><Link className="font-semibold underline underline-offset-4" href="/pricing#programs">{p.name}</Link> <span className="text-muted">· {p.window} · ${p.price}</span></li>
          ))}
        </ul>
      </section>

      <form method="get" role="search" aria-label="Filter templates" className="mt-6 grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <Field label="Search" id="q">
          <Input id="q" name="q" type="search" defaultValue={filters.q ?? ""} placeholder="marathon, budget, Bible…" />
        </Field>
        <Field label="Life area" id="area">
          <Select id="area" name="area" defaultValue={filters.area ?? ""}>
            <option value="">All areas</option>
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </Field>
        <Field label="Type" id="tier">
          <Select id="tier" name="tier" defaultValue={filters.tier ?? ""}>
            <option value="">All types</option>
            {TIERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button type="submit">Show</Button>
          {filtered && <Link href="/marketplace" className="inline-flex min-h-11 items-center px-2 text-sm underline">Clear</Link>}
        </div>
      </form>

      <p className="mt-4 text-sm text-muted" aria-live="polite">{items.length} template{items.length === 1 ? "" : "s"}{filtered ? " match" : ""}</p>

      {items.length ? (
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <li key={t.id}><TemplateCard t={t} creatorName={t.creator_id ? names.get(t.creator_id) : null} /></li>
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          <Empty title="No templates match yet">
            Try a different word or area, or <Link className="underline" href="/login?next=/onboarding">start a goal from scratch</Link>.
          </Empty>
        </div>
      )}

      <p className="mt-8 text-sm text-muted">
        Templates are plans and education, not medical or financial advice. Health templates include a &ldquo;talk to your doctor&rdquo; step.
        Coach, pastor or club leader? <Link className="underline" href="/creators">Sell your own templates</Link>.
      </p>
    </SiteShell>
  );
}
