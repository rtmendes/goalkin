import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell, START_HREF } from "@/components/site/site-shell";
import { CheckoutButton } from "@/components/site/checkout-button";
import { RingBadge, TierBadge } from "@/components/marketplace/ring-badge";
import { Button, ButtonLink, Card, Notice } from "@/components/ui";
import { getTemplate, readCatalog } from "@/lib/templates";
import { serverEnv } from "@/lib/env";
import { buildPlan, requiredGuardrails } from "@/lib/plan";
import { APPROACHES } from "@/lib/approach";
import { checkoutHref } from "@/lib/commerce/checkout";
import { PROGRAMS } from "@/lib/commerce/products";
import { formatPrice } from "@/lib/marketplace/filters";
import { creatorNames } from "@/lib/marketplace/creators";
import { optionalUser } from "@/lib/site/session";
import type { Visibility } from "@/lib/types";
import { addFreeTemplate } from "./actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const QUESTION_KIND: Record<string, string> = {
  text: "short answer", number: "number", slider: "slider", choice: "pick one", multi_choice: "pick any",
  date: "date", calendar_slots: "pick times on a calendar",
};

async function load(id: string) {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const full = await getTemplate(id).catch(() => null);
  if (full) return { kind: "full" as const, ...full };
  const entry = (await readCatalog().catch(() => [])).find((c) => c.id === id);
  return entry ? { kind: "catalog" as const, entry } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await load((await params).id);
  if (!t) return { title: "Template not found" };
  return t.kind === "full" ? { title: t.body.name, description: t.body.summary } : { title: t.entry.name, description: t.entry.ai_builds };
}

const today = () => new Date().toISOString().slice(0, 10);

export default async function TemplatePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const t = await load(id);
  if (!t) notFound();
  const session = await optionalUser();

  if (t.kind === "catalog") return <CatalogOnly entry={t.entry} signedIn={!!session} />;

  const { body, listing } = t;
  const status = (listing as { status?: string }).status ?? "published";
  const published = status === "published";

  let owned = false;
  if (session) {
    const { data } = await session.supabase.from("gk_library").select("template_id").eq("template_id", id).maybeSingle();
    owned = !!data;
  }
  const creatorName = listing.creator_id ? (await creatorNames([listing.creator_id])).get(listing.creator_id) : null;
  const program = PROGRAMS[id];
  const buyHref = checkoutHref(listing.checkout_url || (program ? serverEnv().checkout[program.checkoutKey] : ""), session?.user.email);
  const isFree = listing.tier === "Free";
  const guardrails = requiredGuardrails(body.area, body);
  // Sample week for a person who feels ready (no readiness answers would shrink it to starter size).
  const ready = { time: 4, energy: 4, money: 4, support: 4, focus: 4 };
  const sample = buildPlan({ template: body, title: body.name, area: body.area, startDate: today(), readiness: ready }).items.filter((i) => i.week === 1 && i.kind !== "guardrail");

  return (
    <SiteShell>
      <nav aria-label="Breadcrumb" className="text-sm"><Link href="/marketplace" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"><span aria-hidden>←&nbsp;</span>All templates</Link></nav>
      {!published && <div className="mb-4"><Notice tone="warn">Preview only: this template is <b>{status.replace("_", " ")}</b> and not in the marketplace yet.</Notice></div>}
      {one(sp.error) === "library" && <div className="mb-4"><Notice tone="warn">We couldn&apos;t add this to your library just now. Please try again in a moment.</Notice></div>}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <header>
            <div className="flex flex-wrap items-center gap-2"><TierBadge tier={listing.tier} /><span className="text-sm text-muted">{body.area}{body.duration ? ` · ${body.duration}` : ""}</span></div>
            <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{body.name}</h1>
            {creatorName && <p className="mt-1 text-muted">A creator template by <b className="text-ink">{creatorName}</b></p>}
            <p className="mt-3 text-lg text-muted">{body.summary}</p>
          </header>

          {guardrails.length > 0 && (
            <section aria-labelledby="guard" className="rounded-2xl border-2 border-gold bg-gold/10 p-4">
              <h2 id="guard" className="font-semibold"><span aria-hidden>🛡 </span>Built-in safety steps</h2>
              <p className="text-sm text-muted">These stay in your plan. You can complete them, but not delete them.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{guardrails.map((g) => <li key={g}>{g}</li>)}</ul>
            </section>
          )}

          <section aria-labelledby="asked">
            <h2 id="asked" className="font-display text-2xl font-bold">What you&apos;ll be asked</h2>
            <p className="text-sm text-muted">Your answers fit the plan to you. Skip anything.</p>
            <ol className="mt-3 space-y-2">
              {body.onboarding.map((q, i) => (
                <li key={q.id} className="rounded-xl border border-line bg-surface p-3">
                  <p className="font-medium">{i + 1}. {q.prompt}</p>
                  <p className="text-xs text-muted">{QUESTION_KIND[q.type] ?? q.type}{q.options?.length ? `: ${q.options.join(" · ")}` : ""}{q.optional ? " · optional" : ""}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="phases">
            <h2 id="phases" className="font-display text-2xl font-bold">The plan</h2>
            <p className="text-sm text-muted">Phases stretch or shrink to your dates. The AI drafts the details; you edit, remove or add anything.</p>
            <ol className="mt-3 space-y-3">
              {body.plan_blueprint.phases.map((p) => (
                <li key={p.name}>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">{p.name}</h3><span className="text-sm text-muted">Weeks {p.weeks}</span></div>
                    {!!p.actions?.length && <><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Actions</p><ul className="list-disc pl-5 text-sm">{p.actions.map((a) => <li key={a}>{a}</li>)}</ul></>}
                    {!!p.benchmarks?.length && <><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Checkpoints</p><ul className="text-sm">{p.benchmarks.map((b) => <li key={b}><span aria-hidden className="text-sage-ink">◆ </span>{b}</li>)}</ul></>}
                  </Card>
                </li>
              ))}
            </ol>
            {body.plan_blueprint.calendar && <p className="mt-2 text-sm text-muted"><span aria-hidden>📅 </span>{body.plan_blueprint.calendar}</p>}
            {sample.length > 0 && (
              <details className="mt-3 rounded-xl border border-line bg-surface p-3">
                <summary className="min-h-11 cursor-pointer content-center font-semibold">See a sample first week</summary>
                <ul className="mt-2 space-y-1 text-sm">{sample.map((s) => <li key={s.sort}><span className="text-muted">{s.due_date}</span> · {s.title}</li>)}</ul>
              </details>
            )}
          </section>

          {body.tracked_fields.length > 0 && (
            <section aria-labelledby="tracked">
              <h2 id="tracked" className="font-display text-2xl font-bold">What&apos;s tracked, and who sees it</h2>
              <p className="text-sm text-muted">Suggested rings for each number. Your goal still starts Private, and nothing is shared until you choose and see a preview.</p>
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
                {body.tracked_fields.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <span>{f.label}{f.unit ? <span className="text-muted"> ({f.unit})</span> : null}</span>
                    <RingBadge ring={f.default_visibility as Visibility} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {body.approach_variants && Object.keys(body.approach_variants).length > 0 && (
            <section aria-labelledby="approach">
              <h2 id="approach" className="font-display text-2xl font-bold">Fits how you work</h2>
              <dl className="mt-3 space-y-2">
                {APPROACHES.filter((a) => body.approach_variants?.[a.id]).map((a) => (
                  <div key={a.id} className="rounded-xl border border-line bg-surface p-3">
                    <dt className="font-semibold">{a.name}</dt>
                    <dd className="text-sm text-muted">{body.approach_variants?.[a.id]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {body.restart_rules && (
            <section aria-labelledby="restart">
              <h2 id="restart" className="font-display text-2xl font-bold">If you miss days</h2>
              <p className="mt-2">{body.restart_rules}</p>
            </section>
          )}

          {!!body.addon_tracks?.length && (
            <section aria-labelledby="addons">
              <h2 id="addons" className="font-display text-2xl font-bold">Optional add-ons</h2>
              <p className="text-sm text-muted">Suggestions only. Not needed to finish the plan.</p>
              <ul className="mt-2 space-y-1">{body.addon_tracks.map((a) => <li key={a}><span className="mr-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold">Suggestion</span>{a}</li>)}</ul>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <p className="font-display text-3xl font-bold">{formatPrice(listing.tier, listing.price)}</p>
            <p className="text-sm text-muted">{isFree ? "Free to add. Keep it in your library." : "One-time purchase. Stays in your library; run it again any time."}</p>
            <div className="mt-4 space-y-2">
              {!published ? (
                <Button type="button" variant="secondary" disabled className="w-full">Not available yet</Button>
              ) : owned ? (
                <ButtonLink href={`/onboarding?template=${id}`} className="w-full">Start this plan</ButtonLink>
              ) : isFree ? (
                session ? (
                  <form action={addFreeTemplate}>
                    <input type="hidden" name="id" value={id} />
                    <Button type="submit" className="w-full">Add to my library</Button>
                  </form>
                ) : (
                  <ButtonLink href={`/login?next=${encodeURIComponent(`/marketplace/${id}`)}`} className="w-full">Sign in to add it free</ButtonLink>
                )
              ) : (
                <CheckoutButton href={buyHref} label={`Buy for ${formatPrice(listing.tier, listing.price)}`} />
              )}
            </div>
            {published && !owned && !isFree && (
              <p className="mt-3 text-xs text-muted">
                {session ? <>Checkout opens with <b>{session.user.email}</b> so it unlocks this account.</> : <>Use the email you sign in with so the purchase unlocks your account.</>}
              </p>
            )}
            <p className="mt-3 text-xs text-muted">A plan and education, not medical or financial advice. Results depend on you.</p>
          </Card>
        </aside>
      </div>
    </SiteShell>
  );
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

const VIS_WORDS: [RegExp, Visibility][] = [[/\bPub\b/, "public"], [/\bCi\b/, "circle"], [/\bC\b/, "chosen"], [/\bP\b/, "private"]];

function CatalogOnly({ entry, signedIn }: { entry: Awaited<ReturnType<typeof readCatalog>>[number]; signedIn: boolean }) {
  // Catalog shorthand like "Distance Ci; pace P" -> readable rings.
  const parts = entry.default_visibility.split(/;\s*/).map((p) => {
    const ring = VIS_WORDS.find(([re]) => re.test(p))?.[1] ?? "private";
    return { label: p.replace(/\b(Pub|Ci|C|P)\b/g, "").replace(/\bAll\b/, "Everything").trim() || "Everything", ring };
  });
  return (
    <SiteShell>
      <nav aria-label="Breadcrumb" className="text-sm"><Link href="/marketplace" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"><span aria-hidden>←&nbsp;</span>All templates</Link></nav>
      <div className="max-w-3xl space-y-6">
        <header>
          <div className="flex flex-wrap items-center gap-2"><TierBadge tier={entry.tier} /><span className="text-sm text-muted">{entry.area}</span></div>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{entry.name}</h1>
          <p className="mt-3 text-lg text-muted">{entry.ai_builds}</p>
        </header>
        <Notice>The full step-by-step version of this template is being finished. You can still start a goal like it today; the AI drafts a plan from your answers.</Notice>
        {entry.area === "Health" && <Notice tone="warn"><span aria-hidden>🛡 </span>Health plans include a &ldquo;talk to your doctor&rdquo; step. GoalKin offers education, not medical advice.</Notice>}
        <section aria-labelledby="asked"><h2 id="asked" className="font-display text-2xl font-bold">What you&apos;ll be asked</h2><ul className="mt-2 list-disc pl-5">{entry.onboarding_inputs.map((q) => <li key={q}>{q}</li>)}</ul></section>
        <section aria-labelledby="tracked">
          <h2 id="tracked" className="font-display text-2xl font-bold">What&apos;s tracked, and who sees it</h2>
          <p className="text-sm text-muted">Tracks: {entry.tracks.join(", ")}. Suggested rings below; your goal still starts Private.</p>
          <ul className="mt-2 space-y-1">{parts.map((p) => <li key={p.label} className="flex items-center gap-2"><RingBadge ring={p.ring} /> {p.label}</li>)}</ul>
        </section>
        <ButtonLink href={signedIn ? "/onboarding" : START_HREF}>Start a goal like this</ButtonLink>
      </div>
    </SiteShell>
  );
}
