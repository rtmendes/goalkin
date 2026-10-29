import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/site-shell";
import { StatusTag } from "@/components/marketplace/template-status";
import { Button, ButtonLink, Card, Empty, Notice, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMetricsData } from "@/lib/marketplace/admin-data";
import { experimentReport, pct, salesTotals, week4Retention, type ExperimentStats, type Retention } from "@/lib/marketplace/metrics";
import { decideCreator } from "./actions";

export const metadata: Metadata = { title: "Admin" };

interface QueueRow { id: string; name: string; area: string; price: number; creator_id: string | null; updated_at: string }
interface CreatorRow { user_id: string; display_name: string; bio: string | null; website: string | null; status: string; created_at: string }
interface PurchaseRow { id: string; email: string; product: string; amount: number | null; creator_share: number | null; user_id: string | null; created_at: string }

const when = (s: string) => new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const MSG: Record<string, string> = {
  review: "That review form was incomplete.", not_in_review: "That template is no longer in review.", creator: "Couldn't update that creator.",
};

async function load() {
  const db = createAdminClient();
  const [queue, creators, purchases, metrics] = await Promise.all([
    db.from("gk_templates").select("id, name, area, price, creator_id, updated_at").eq("status", "in_review").order("updated_at"),
    db.from("gk_creators").select("user_id, display_name, bio, website, status, created_at").order("created_at", { ascending: false }).limit(100),
    db.from("gk_purchases").select("id, email, product, amount, creator_share, user_id, created_at").order("created_at", { ascending: false }).limit(25),
    loadMetricsData(),
  ]);
  const now = new Date();
  return {
    queue: (queue.data ?? []) as QueueRow[],
    creators: (creators.data ?? []) as CreatorRow[],
    purchases: (purchases.data ?? []) as PurchaseRow[],
    retention: week4Retention({ goals: metrics.goals, checkIns: metrics.checkIns, now }),
    experiments: experimentReport({ ...metrics, now }),
    goalsFinished: metrics.goals.filter((g) => g.status === "finished").length,
    people: new Set(metrics.goals.map((g) => g.owner_id)).size,
  };
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  let data: Awaited<ReturnType<typeof load>> | null = null;
  try {
    data = await load();
  } catch (err) {
    console.error("admin load failed", err);
  }

  return (
    <SiteShell>
      <PageHeader title="Admin" sub="Reviews, creators, split tests and the week-4 metric." />
      <div className="mb-4 space-y-2">
        {typeof sp.reviewed === "string" && <Notice>Review saved for {sp.reviewed}.</Notice>}
        {typeof sp.error === "string" && <Notice tone="warn">{MSG[sp.error] ?? "Something went wrong."}</Notice>}
        {!data && <Notice tone="warn">Couldn&apos;t reach the database. Check SUPABASE_SERVICE_ROLE_KEY and that the migration ran.</Notice>}
      </div>

      {data && (
        <>
          <section aria-labelledby="north" className="grid gap-4 sm:grid-cols-3">
            <MetricCard id="north" title="Week-4 check-in rate" r={data.retention} />
            <Card><p className="text-sm text-muted">People with a goal</p><p className="font-display text-3xl font-bold">{data.people}</p></Card>
            <Card><p className="text-sm text-muted">Goals finished</p><p className="font-display text-3xl font-bold">{data.goalsFinished}</p></Card>
          </section>

          <section aria-labelledby="queue" className="mt-8">
            <h2 id="queue" className="font-display text-2xl font-bold">Review queue <span className="text-base font-normal text-muted">({data.queue.length})</span></h2>
            {data.queue.length ? (
              <ul className="mt-3 space-y-2">
                {data.queue.map((t) => (
                  <li key={t.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-sm text-muted">{t.area} · ${Number(t.price)} · submitted {when(t.updated_at)}</p>
                      </div>
                      <ButtonLink href={`/admin/review/${t.id}`}>Review</ButtonLink>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : <div className="mt-3"><Empty title="Nothing waiting for review" /></div>}
          </section>

          <section id="creators" aria-labelledby="creators-h" className="mt-8 scroll-mt-6">
            <h2 id="creators-h" className="font-display text-2xl font-bold">Creator applications</h2>
            {data.creators.length ? (
              <ul className="mt-3 space-y-2">
                {data.creators.map((c) => (
                  <li key={c.user_id}>
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{c.display_name} <StatusTag status={c.status} /></p>
                          {c.website && <p className="truncate text-sm"><a className="underline" href={c.website} rel="noopener noreferrer nofollow" target="_blank">{c.website}</a></p>}
                          {c.bio && <p className="mt-1 text-sm text-muted">{c.bio}</p>}
                          <p className="text-xs text-muted">Applied {when(c.created_at)}</p>
                        </div>
                        {c.status !== "approved" && c.status !== "rejected" && (
                          <form action={decideCreator} className="flex gap-2">
                            <input type="hidden" name="user_id" value={c.user_id} />
                            <Button type="submit" name="decision" value="approved" variant="sage" aria-label={`Approve ${c.display_name}`}>Approve</Button>
                            <Button type="submit" name="decision" value="rejected" variant="secondary" aria-label={`Reject ${c.display_name}`}>Reject</Button>
                          </form>
                        )}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : <div className="mt-3"><Empty title="No applications yet" /></div>}
          </section>

          <section aria-labelledby="exp" className="mt-8">
            <h2 id="exp" className="font-display text-2xl font-bold">Split tests</h2>
            <p className="text-sm text-muted">Week-4 rate = share of people (first goal 28+ days old) with a check-in on days 22 to 28. Eligible counts only those people.</p>
            {data.experiments.length ? (
              <div className="mt-3 space-y-4">{data.experiments.map((e) => <ExperimentTable key={e.id} e={e} />)}</div>
            ) : <div className="mt-3"><Empty title="No experiments yet" /></div>}
          </section>

          <section aria-labelledby="sales" className="mt-8">
            <h2 id="sales" className="font-display text-2xl font-bold">Recent purchases</h2>
            {(() => {
              const t = salesTotals(data.purchases);
              return <p className="text-sm text-muted">Last {t.count}: ${t.gross.toFixed(2)} gross, ${t.creatorShare.toFixed(2)} to creators.</p>;
            })()}
            {data.purchases.length ? (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <caption className="sr-only">Recent purchases</caption>
                  <thead className="border-b border-line text-muted"><tr><th className="p-3">When</th><th className="p-3">Email</th><th className="p-3">Product</th><th className="p-3">Amount</th><th className="p-3">Applied</th></tr></thead>
                  <tbody>
                    {data.purchases.map((p) => (
                      <tr key={p.id} className="border-b border-line last:border-0">
                        <td className="p-3">{when(p.created_at)}</td>
                        <td className="p-3">{p.email}</td>
                        <td className="p-3">{p.product.startsWith("unknown:") ? <span className="text-coral-ink"><span aria-hidden>! </span>Unmapped: {p.product.slice(8)}</span> : p.product}</td>
                        <td className="p-3">{p.amount != null ? `$${Number(p.amount).toFixed(2)}` : "n/a"}</td>
                        <td className="p-3">{p.user_id ? "✓ Yes" : p.product.startsWith("unknown:") ? "Needs a product mapping" : "Waiting for sign-in"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="mt-3"><Empty title="No purchases yet" /></div>}
          </section>
        </>
      )}
      <p className="mt-8 text-sm"><Link className="underline" href="/app">Back to the app</Link></p>
    </SiteShell>
  );
}

function MetricCard({ id, title, r }: { id: string; title: string; r: Retention }) {
  return (
    <Card className="border-2 border-sage">
      <h2 id={id} className="text-sm text-muted">{title}</h2>
      <p className="font-display text-3xl font-bold">{pct(r.rate)}</p>
      <p className="text-xs text-muted">{r.retained} of {r.eligible} eligible people checked in on days 22 to 28.</p>
    </Card>
  );
}

function ExperimentTable({ e }: { e: ExperimentStats }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="p-3 text-left font-semibold">{e.name} <span className="font-normal text-muted">({e.id}) · {e.active ? "running" : "stopped"}</span></caption>
        <thead className="border-y border-line text-muted">
          <tr><th className="p-3">Variant</th><th className="p-3">Assigned</th><th className="p-3">Eligible</th><th className="p-3">Week-4 rate</th><th className="p-3">Goals finished</th></tr>
        </thead>
        <tbody>
          {e.variants.map((v) => (
            <tr key={v.key} className="border-b border-line last:border-0">
              <th scope="row" className="p-3 font-semibold">{v.key}</th>
              <td className="p-3">{v.assigned}</td>
              <td className="p-3">{v.eligible}</td>
              <td className="p-3">{pct(v.rate)} <span className="text-muted">({v.retained})</span></td>
              <td className="p-3">{v.goalsFinished}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
