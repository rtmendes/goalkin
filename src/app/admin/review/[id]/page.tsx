import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site/site-shell";
import { RingBadge } from "@/components/marketplace/ring-badge";
import { StatusTag } from "@/components/marketplace/template-status";
import { Button, Card, Field, Input, Notice, PageHeader, Textarea } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoChecks, MANUAL_CHECKS } from "@/lib/marketplace/review";
import { creatorNames } from "@/lib/marketplace/creators";
import { requiredGuardrails } from "@/lib/plan";
import type { TemplateBody, Visibility } from "@/lib/types";
import { reviewTemplate } from "../../actions";

export const metadata: Metadata = { title: "Review template" };

const ERR: Record<string, string> = {
  checklist: "Every check must pass before approving.",
  note: "Add a note telling the creator what to change or why it was not accepted.",
  checkout: "That checkout link isn't a valid web address.",
  save: "Couldn't save the review. Try again.",
};

function Check({ ok, label, children }: { ok: boolean; label: string; children?: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <p className="font-semibold">
        <span className={ok ? "text-sage-ink" : "text-coral-ink"}><span aria-hidden>{ok ? "✓ " : "✕ "}</span>{ok ? "Pass" : "Fail"}:</span> {label}
      </p>
      {children && <div className="mt-2 text-sm">{children}</div>}
    </li>
  );
}

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[a-z0-9-]+$/.test(id)) notFound();
  const { data: t } = await createAdminClient().from("gk_templates").select("id, name, status, price, body, creator_id, checkout_url").eq("id", id).maybeSingle();
  if (!t) notFound();
  const body = t.body as TemplateBody;
  const today = new Date().toISOString().slice(0, 10);
  const auto = autoChecks(body, today);
  const creator = t.creator_id ? (await creatorNames([t.creator_id as string])).get(t.creator_id as string) : null;
  const autoPass = auto.schema.ok && auto.planTest.ok && auto.claims.ok && auto.doctorStep.ok && auto.visibility.ok;

  return (
    <SiteShell>
      <nav aria-label="Breadcrumb" className="text-sm"><Link href="/admin" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"><span aria-hidden>←&nbsp;</span>Admin</Link></nav>
      <PageHeader title={t.name as string} sub={<>{creator ? `By ${creator} · ` : ""}${Number(t.price)} · <StatusTag status={t.status as string} /> · <Link className="underline" href={`/marketplace/${id}`}>Preview listing</Link></>} />
      {typeof sp.error === "string" && <div className="mb-4"><Notice tone="warn">{ERR[sp.error] ?? "Something went wrong."}</Notice></div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="auto" className="min-w-0">
          <h2 id="auto" className="font-display text-2xl font-bold">Checklist</h2>
          <ul className="mt-3 space-y-2">
            <Check ok={auto.schema.ok} label="Validates against the template schema">
              {!auto.schema.ok && <ul className="list-disc pl-5">{auto.schema.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            </Check>
            <Check ok={auto.planTest.ok} label="Plan generator makes a realistic plan for three sample people">
              <ul className="space-y-2">
                {auto.planTest.samples.map((s) => (
                  <li key={s.person}>
                    <details className="rounded-lg bg-surface-2 p-2">
                      <summary className="min-h-11 cursor-pointer content-center">
                        <span className={s.realistic ? "text-sage-ink" : "text-coral-ink"}><span aria-hidden>{s.realistic ? "✓" : "✕"}</span> {s.realistic ? "OK" : "Check"}</span>{" "}
                        <b>{s.person}</b>: {s.totalWeeks} weeks, {s.itemCount} items, {s.firstWeek.length} in week 1
                      </summary>
                      <ul className="mt-1 space-y-0.5 pl-2">
                        {s.firstWeek.map((i, n) => <li key={n}><span className="text-muted">{i.due_date} · {i.kind}{i.required ? " · required" : ""}</span> · {i.title}</li>)}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            </Check>
            <Check ok={auto.claims.ok} label="Automatic scan: no medical, financial or guaranteed-result claims">
              {!auto.claims.ok && <ul className="list-disc pl-5">{auto.claims.hits.map((h, i) => <li key={i}>{h.where}: &ldquo;{h.phrase}&rdquo; ({h.why})</li>)}</ul>}
            </Check>
            <Check ok={auto.doctorStep.ok} label={auto.doctorStep.needed ? "Health template includes the doctor step" : "Doctor step not needed for this area"} />
            <Check ok={auto.visibility.ok} label="Health and money numbers default to Private">
              {!auto.visibility.ok && <p>Not private: {auto.visibility.offenders.join(", ")}</p>}
            </Check>
          </ul>

          <h2 className="mt-8 font-display text-2xl font-bold">Content</h2>
          <Card className="mt-3 space-y-4 text-sm">
            <p><b>Area:</b> {body.area} · <b>Length:</b> {body.duration ?? "n/a"}</p>
            <p><b>Summary:</b> {body.summary}</p>
            <div><b>Questions</b><ol className="list-decimal pl-5">{body.onboarding?.map((q) => <li key={q.id}>{q.prompt} <span className="text-muted">({q.type}{q.options?.length ? `: ${q.options.join(" / ")}` : ""})</span></li>)}</ol></div>
            <div><b>Phases</b>
              <ul className="space-y-1">{body.plan_blueprint?.phases?.map((p) => <li key={p.name}><b>{p.name}</b> (weeks {p.weeks}): {(p.actions ?? []).join("; ")}{p.benchmarks?.length ? ` · checkpoints: ${p.benchmarks.join("; ")}` : ""}</li>)}</ul>
            </div>
            <div><b>Tracked</b><ul>{body.tracked_fields?.map((f) => <li key={f.id} className="flex flex-wrap items-center gap-2">{f.label} ({f.kind}) <RingBadge ring={f.default_visibility as Visibility} /></li>)}</ul></div>
            <div><b>Guardrails (as built into plans)</b><ul className="list-disc pl-5">{requiredGuardrails(body.area, body).map((g) => <li key={g}>{g}</li>)}</ul></div>
            {body.restart_rules && <p><b>Restart rules:</b> {body.restart_rules}</p>}
            {!!body.addon_tracks?.length && <p><b>Suggested add-ons:</b> {body.addon_tracks.join("; ")}</p>}
          </Card>
        </section>

        <aside>
          <Card className="lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold">Decision</h2>
            {t.status !== "in_review" ? (
              <p className="mt-2 text-sm text-muted">This template is not in review right now.</p>
            ) : (
              <form action={reviewTemplate} className="mt-3 space-y-4">
                <input type="hidden" name="id" value={id} />
                <fieldset className="space-y-2">
                  <legend className="mb-1 text-sm font-semibold">Manual checks</legend>
                  {MANUAL_CHECKS.map((c) => (
                    <label key={c.id} className="flex min-h-11 items-start gap-3 text-sm">
                      <input type="checkbox" name={c.id} value="yes" className="mt-0.5 h-5 w-5 shrink-0" />{c.label}
                    </label>
                  ))}
                </fieldset>
                {!autoPass && <Notice tone="warn">Automatic checks are failing, so this can&apos;t be approved. Request changes instead.</Notice>}
                <Field label="Checkout link (GoHighLevel order form)" id="checkout_url" hint="Needed for buyers to pay. You can add it later.">
                  <Input id="checkout_url" name="checkout_url" type="url" defaultValue={(t.checkout_url as string | null) ?? ""} placeholder="https://" />
                </Field>
                <Field label="Note to the creator" id="note" hint="Required when requesting changes or rejecting.">
                  <Textarea id="note" name="note" maxLength={2000} />
                </Field>
                <div className="grid gap-2">
                  <Button type="submit" name="decision" value="approved" variant="sage" disabled={!autoPass}>Approve and publish</Button>
                  <Button type="submit" name="decision" value="changes_requested" variant="secondary">Request changes</Button>
                  <Button type="submit" name="decision" value="rejected" variant="danger">Reject</Button>
                </div>
              </form>
            )}
          </Card>
        </aside>
      </div>
    </SiteShell>
  );
}
