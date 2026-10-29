import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/site-shell";
import { TemplateEditor } from "@/components/marketplace/template-editor";
import { ButtonLink, Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "New template" };

export default async function NewTemplatePage() {
  const { supabase, user } = await requireUser("/creators/templates/new");
  const { data } = await supabase.from("gk_creators").select("status").eq("user_id", user.id).maybeSingle();

  return (
    <SiteShell>
      <nav aria-label="Breadcrumb" className="text-sm"><Link href="/creators/dashboard" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"><span aria-hidden>←&nbsp;</span>Creator dashboard</Link></nav>
      <PageHeader title="New template" sub="Build it step by step. Save a draft any time; submit for review when the checks pass." />
      {data?.status === "approved" ? (
        <TemplateEditor id={null} initial={null} />
      ) : (
        <Empty title="Creator approval needed">
          <p>Templates can be built once your creator application is approved.</p>
          <p className="mt-3"><ButtonLink href={data ? "/creators/dashboard" : "/creators#apply"}>{data ? "See your application" : "Apply to be a creator"}</ButtonLink></p>
        </Empty>
      )}
    </SiteShell>
  );
}
