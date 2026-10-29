import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site/site-shell";
import { TemplateEditor } from "@/components/marketplace/template-editor";
import { StatusTag } from "@/components/marketplace/template-status";
import { Button, Card, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { validateTemplate } from "@/lib/marketplace/template-schema";
import type { TemplateBody } from "@/lib/types";
import { submitForReview } from "../../../actions";

export const metadata: Metadata = { title: "Edit template" };

const EDITABLE = ["draft", "in_review", "rejected"];

export default async function EditTemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[a-z0-9-]+$/.test(id)) notFound();
  const { supabase, user } = await requireUser(`/creators/templates/${id}/edit`);
  const { data: t } = await supabase.from("gk_templates").select("id, name, status, body").eq("id", id).eq("creator_id", user.id).maybeSingle();
  if (!t) notFound();
  const { data: reviews } = await supabase.from("gk_template_reviews").select("decision, note, created_at").eq("template_id", id).order("created_at", { ascending: false }).limit(5);

  const status = t.status as string;
  const editable = EDITABLE.includes(status);
  const check = validateTemplate(t.body);

  return (
    <SiteShell>
      <nav aria-label="Breadcrumb" className="text-sm"><Link href="/creators/dashboard" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"><span aria-hidden>←&nbsp;</span>Creator dashboard</Link></nav>
      <PageHeader title={t.name as string} sub={<>Status: <StatusTag status={status} /></>} />

      <div className="mb-5 space-y-3">
        {sp.saved && <Notice>Draft saved.</Notice>}
        {sp.error === "invalid" && <Notice tone="warn">This template still has things to fix before it can be reviewed. See the list at the bottom.</Notice>}
        {sp.error === "submit" && <Notice tone="warn">We couldn&apos;t submit it just now. Please try again.</Notice>}
        {status === "in_review" && <Notice>It&apos;s with our reviewers. Saving changes moves it back to draft, so you&apos;d need to submit again.</Notice>}
        {!editable && <Notice>Published templates are locked so buyers keep the version they paid for. Contact us to change this one.</Notice>}
        {(reviews ?? []).map((r) => (
          <Card key={r.created_at as string}>
            <p className="font-semibold">Reviewer feedback: <StatusTag status={r.decision as string} /></p>
            {r.note && <p className="mt-1">{r.note as string}</p>}
          </Card>
        ))}
      </div>

      <TemplateEditor id={id} initial={t.body as TemplateBody} readOnly={!editable} />

      {editable && status !== "in_review" && (
        <form action={submitForReview} className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="sage" disabled={!check.ok}>Submit saved version for review</Button>
          <p className="text-sm text-muted">{check.ok ? "Submits the last saved draft. Save first if you changed anything." : "Save a version that passes every check to submit."}</p>
        </form>
      )}
    </SiteShell>
  );
}
