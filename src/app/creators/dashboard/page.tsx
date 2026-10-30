import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/site-shell";
import { StatusTag } from "@/components/marketplace/template-status";
import { ButtonLink, Card, Empty, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { salesTotals } from "@/lib/marketplace/metrics";
import { formatPrice } from "@/lib/marketplace/filters";

export const metadata: Metadata = { title: "Creator dashboard" };

interface TemplateRow { id: string; name: string; status: string; price: number; tier: string; updated_at: string }
interface ReviewRow { template_id: string; decision: string; note: string | null; created_at: string }
interface SaleRow { id: string; product: string; amount: number | null; creator_share: number | null; created_at: string }

const money = (n: number) => `$${n.toFixed(2)}`;
const date = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function CreatorDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser("/creators/dashboard");
  const { data: creator } = await supabase.from("gk_creators").select("display_name, status, created_at").eq("user_id", user.id).maybeSingle();

  if (!creator) {
    return (
      <SiteShell width="narrow">
        <PageHeader title="Creator dashboard" />
        <Empty title="You haven't applied yet">
          <p>Creators sell templates in the GoalKin marketplace and keep 70% of each sale.</p>
          <p className="mt-3"><ButtonLink href="/creators#apply">Apply to be a creator</ButtonLink></p>
        </Empty>
      </SiteShell>
    );
  }

  if (creator.status !== "approved") {
    const msg: Record<string, string> = {
      applied: "Thanks for applying. We review every application by hand and will email you when there's news.",
      rejected: "We couldn't accept your application this time. Reply to our email if you'd like to talk about it.",
      paused: "Your creator account is paused. Reply to our email if you have questions.",
    };
    return (
      <SiteShell width="narrow">
        <PageHeader title="Creator dashboard" sub={<>Application status: <StatusTag status={creator.status as string} /></>} />
        {sp.applied && <div className="mb-4"><Notice>Application received.</Notice></div>}
        <Card><p>{msg[creator.status as string] ?? "We'll be in touch."}</p></Card>
      </SiteShell>
    );
  }

  const [{ data: templates }, { data: reviews }] = await Promise.all([
    supabase.from("gk_templates").select("id, name, status, price, tier, updated_at").eq("creator_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("gk_template_reviews").select("template_id, decision, note, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  // Sales are read with the service role but strictly filtered to this creator.
  let sales: SaleRow[] = [];
  try {
    const { data } = await createAdminClient()
      .from("gk_purchases").select("id, product, amount, creator_share, created_at")
      .eq("creator_id", user.id).order("created_at", { ascending: false }).limit(500);
    sales = (data ?? []) as SaleRow[];
  } catch {
    /* sales unavailable; show zero */
  }
  const totals = salesTotals(sales);
  const latestReview = new Map<string, ReviewRow>();
  for (const r of (reviews ?? []) as ReviewRow[]) if (!latestReview.has(r.template_id)) latestReview.set(r.template_id, r);
  const rows = (templates ?? []) as TemplateRow[];
  const nameOf = new Map(rows.map((t) => [t.id, t.name]));

  return (
    <SiteShell>
      <PageHeader
        title={`Hi, ${creator.display_name}`}
        sub={<>Creator account <StatusTag status="approved" /></>}
        action={<ButtonLink href="/creators/templates/new">+ New template</ButtonLink>}
      />
      {typeof sp.submitted === "string" && <div className="mb-4"><Notice>Submitted for review. We&apos;ll check it against the review list and email you.</Notice></div>}

      <section aria-labelledby="sales" className="grid gap-4 sm:grid-cols-3">
        <Card><h2 id="sales" className="text-sm text-muted">Sales</h2><p className="font-display text-3xl font-bold">{totals.count}</p></Card>
        <Card><p className="text-sm text-muted">Gross</p><p className="font-display text-3xl font-bold">{money(totals.gross)}</p></Card>
        <Card><p className="text-sm text-muted">Your share (70%)</p><p className="font-display text-3xl font-bold text-sage-ink">{money(totals.creatorShare)}</p></Card>
      </section>

      <section aria-labelledby="mine" className="mt-8">
        <h2 id="mine" className="font-display text-2xl font-bold">Your templates</h2>
        {rows.length ? (
          <ul className="mt-3 space-y-3">
            {rows.map((t) => {
              const r = latestReview.get(t.id);
              return (
                <li key={t.id}>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{t.name}</h3>
                        <p className="text-sm text-muted">{formatPrice(t.tier, Number(t.price))} · updated {date(t.updated_at)}</p>
                      </div>
                      <StatusTag status={t.status} />
                    </div>
                    {r && (
                      <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
                        <p className="font-semibold">Latest review: <StatusTag status={r.decision} /></p>
                        {r.note && <p className="mt-1">{r.note}</p>}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["draft", "in_review", "rejected"].includes(t.status) && <ButtonLink href={`/creators/templates/${t.id}/edit`} variant="secondary">Edit</ButtonLink>}
                      <ButtonLink href={`/marketplace/${t.id}`} variant="ghost">{t.status === "published" ? "View listing" : "Preview"}</ButtonLink>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3"><Empty title="No templates yet"><Link className="underline" href="/creators/templates/new">Start your first template</Link>.</Empty></div>
        )}
      </section>

      <section aria-labelledby="recent" className="mt-8">
        <h2 id="recent" className="font-display text-2xl font-bold">Recent sales</h2>
        {sales.length ? (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[480px] text-left text-sm">
              <caption className="sr-only">Recent sales of your templates</caption>
              <thead className="border-b border-line text-muted"><tr><th className="p-3 font-semibold">Date</th><th className="p-3 font-semibold">Template</th><th className="p-3 font-semibold">Gross</th><th className="p-3 font-semibold">Your share</th></tr></thead>
              <tbody>
                {sales.slice(0, 25).map((s) => {
                  const tid = s.product.replace(/^(template|program):/, "");
                  return (
                    <tr key={s.id} className="border-b border-line last:border-0">
                      <td className="p-3">{date(s.created_at)}</td>
                      <td className="p-3">{nameOf.get(tid) ?? tid}</td>
                      <td className="p-3">{money(Number(s.amount) || 0)}</td>
                      <td className="p-3">{money(Number(s.creator_share) || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-muted">No sales yet. Sales show here as soon as someone buys one of your templates.</p>
        )}
        <p className="mt-3 text-xs text-muted">Buyers&apos; names and emails are never shown here.</p>
      </section>
    </SiteShell>
  );
}
