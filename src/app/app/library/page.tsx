import Link from "next/link";
import { ButtonLink, Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listTemplates } from "@/lib/templates";
import { areaInfo, areaTint } from "@/lib/goals-core/areas";

export const metadata = { title: "My templates" };

type Row = { id: string; name: string; area: string; tier: string; summary: string; source: string };
const SOURCE: Record<string, string> = { purchase: "Purchased", custom: "Made by you", gift: "Gift", free: "Free" };

function TemplateCard({ t }: { t: Row }) {
  const area = areaInfo(t.area);
  return (
    <li className="flex flex-col rounded-2xl border p-4" style={areaTint(area.accent, 8)}>
      <p className="text-xs font-semibold text-muted"><span aria-hidden>{area.icon} </span>{area.label} · {SOURCE[t.source] ?? t.tier}</p>
      <h3 className="mt-1 font-semibold">{t.name}</h3>
      <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">{t.summary}</p>
      <ButtonLink href={`/onboarding?template=${t.id}`} variant="secondary" className="mt-3">Start a goal with it</ButtonLink>
    </li>
  );
}

export default async function LibraryPage() {
  const { supabase, user } = await requireUser("/app/library");
  const [{ data: lib }, all] = await Promise.all([
    supabase.from("gk_library").select("template_id, source, gk_templates(id, name, area, tier, summary)").eq("user_id", user.id).order("acquired_at", { ascending: false }),
    listTemplates().catch(() => []),
  ]);
  const owned: Row[] = (lib ?? []).flatMap((r) => {
    const t = (Array.isArray(r.gk_templates) ? r.gk_templates[0] : r.gk_templates) as Omit<Row, "source"> | null;
    return t ? [{ ...t, source: r.source as string }] : [];
  });
  const ownedIds = new Set(owned.map((o) => o.id));
  const free: Row[] = all.filter((t) => t.tier === "Free" && !ownedIds.has(t.id)).map((t) => ({ ...t, source: "free" }));

  return (
    <div className="space-y-6">
      <PageHeader title="My templates" sub="Templates you own, made, or can use for free."
        action={<ButtonLink href="/app/custom" variant="secondary"><span aria-hidden>✎</span> Build a custom template</ButtonLink>} />
      <section aria-labelledby="owned">
        <h2 id="owned" className="mb-3 font-display text-xl font-bold">Yours</h2>
        {owned.length === 0 ? (
          <Empty title="Nothing here yet">Templates you buy or build show up here. <Link className="underline" href="/marketplace">Browse the marketplace</Link>.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{owned.map((t) => <TemplateCard key={t.id} t={t} />)}</ul>
        )}
      </section>
      <section aria-labelledby="free">
        <h2 id="free" className="mb-3 font-display text-xl font-bold">Free for everyone</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{free.map((t) => <TemplateCard key={t.id} t={t} />)}</ul>
      </section>
    </div>
  );
}
