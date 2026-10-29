import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/site-shell";
import { StatusTag } from "@/components/marketplace/template-status";
import { ButtonLink, Card } from "@/components/ui";
import { optionalUser } from "@/lib/site/session";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Creators",
  description: "Coaches, pastors, trainers and club leaders: sell the plans your people already follow. 70% to you.",
};

const CHECKLIST = [
  "It passes the template format check, and the plan builder makes a realistic plan for three sample people.",
  "No medical, financial or guaranteed-result claims anywhere.",
  "Health, diet and supplement plans include a \"talk to your doctor\" step.",
  "Health and money numbers start Private.",
  "It's your original work and you have the rights to everything in it.",
  "A price is set and the refund policy is shown.",
];

const STEPS = [
  ["Apply", "Tell us who you help. We review applications by hand."],
  ["Build", "Use the template editor: questions, phases, checkpoints, what gets tracked."],
  ["Submit", "We check it against the review list below, usually within a few days."],
  ["Earn", "It goes live in the marketplace. You keep 70% of every sale."],
];

export default async function CreatorsPage() {
  const session = await optionalUser();
  let status: string | null = null;
  if (session) {
    const { data } = await session.supabase.from("gk_creators").select("status").eq("user_id", session.user.id).maybeSingle();
    status = (data?.status as string | undefined) ?? null;
  }

  return (
    <SiteShell>
      <header className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-gold-ink">For coaches, pastors, trainers and club leaders</p>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Sell the plan your people already follow</h1>
        <p className="mt-3 text-lg text-muted">Turn your marathon plan, small-group study or club challenge into a GoalKin template. People answer a few questions and get your plan fitted to their dates, on their calendar, with their people.</p>
      </header>

      <section aria-labelledby="split" className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-1">
          <h2 id="split" className="font-semibold">Revenue share</h2>
          <p className="mt-2 font-display text-4xl font-bold text-sage-ink">70%</p>
          <p className="text-sm text-muted">to you on every sale. GoalKin keeps 30% for hosting, payments, the plan builder and support.</p>
        </Card>
        <Card className="sm:col-span-2">
          <h2 className="font-semibold">How it works</h2>
          <ol className="mt-2 grid gap-3 sm:grid-cols-2">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy font-fun font-black text-[#F7F3EC] dark:bg-gold dark:text-navy">{i + 1}</span>
                <span><b>{t}.</b> <span className="text-muted">{d}</span></span>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section aria-labelledby="review" className="mt-8">
        <h2 id="review" className="font-display text-2xl font-bold">What every template is checked for</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {CHECKLIST.map((c) => <li key={c} className="flex gap-2 rounded-xl border border-line bg-surface p-3 text-sm"><span aria-hidden className="text-sage-ink">✓</span>{c}</li>)}
        </ul>
      </section>

      <section aria-labelledby="terms" className="mt-8 max-w-3xl">
        <h2 id="terms" className="font-display text-2xl font-bold">Creator terms, in short</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>You keep ownership of your content and give GoalKin a license to host, show and sell it in the app.</li>
          <li>Templates are plans and education. No medical, financial or guaranteed-result claims, ever.</li>
          <li>Payments run through our processor (GoHighLevel). You earn 70% of each sale, paid out to your payout email&apos;s account.</li>
          <li>A reported template may be hidden while we review it. You can appeal, and you can unpublish your own templates.</li>
        </ul>
        <p className="mt-2 text-sm"><Link href="/legal/terms#creators" className="underline">Read the full creator terms</Link> (draft, pending legal review).</p>
      </section>

      <section id="apply" aria-labelledby="apply-h" className="mt-10 max-w-2xl scroll-mt-6">
        <h2 id="apply-h" className="font-display text-2xl font-bold">Apply</h2>
        <Card className="mt-3">
          {!session ? (
            <div className="space-y-3">
              <p>Sign in or create a free account first, then come back here to apply.</p>
              <ButtonLink href="/login?next=/creators%23apply">Sign in to apply</ButtonLink>
            </div>
          ) : status ? (
            <div className="space-y-3">
              <p>Your creator application: <StatusTag status={status} /></p>
              <ButtonLink href="/creators/dashboard">Open your creator dashboard</ButtonLink>
            </div>
          ) : (
            <ApplyForm defaultName={(session.user.user_metadata?.full_name as string | undefined) ?? ""} defaultEmail={session.user.email ?? ""} />
          )}
        </Card>
      </section>
    </SiteShell>
  );
}
