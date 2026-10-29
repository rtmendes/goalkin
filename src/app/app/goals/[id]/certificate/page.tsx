import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";
import { loadOwnGoal } from "@/lib/goals";
import { areaInfo } from "@/lib/goals-core/areas";
import { formatDay } from "@/lib/goals-core/dates";
import { PrintButton } from "@/components/goals/print-button";

export const metadata = { title: "Finish certificate" };

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireUser(`/app/goals/${id}/certificate`);
  const bundle = await loadOwnGoal(id).catch(() => null);
  if (!bundle) notFound();
  const { goal, checkIns, planItems } = bundle;
  const area = areaInfo(goal.area);
  const finished = goal.status === "finished";
  const done = planItems.filter((p) => p.done).length;
  const days = checkIns.filter((c) => c.status !== "missed").length;
  const long = { month: "long", day: "numeric", year: "numeric" } as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link href={`/app/goals/${id}`} className="min-h-11 rounded-xl px-3 py-2.5 text-sm font-semibold underline">Back to goal</Link>
        <PrintButton />
      </div>
      {!finished && <p className="rounded-xl bg-surface-2 p-3 text-sm print:hidden">This goal isn’t marked finished yet. Here’s how the certificate will look.</p>}
      <article className="mx-auto max-w-2xl rounded-3xl border-4 border-double bg-surface p-8 text-center shadow-sm sm:p-12 print:border-black print:shadow-none" style={{ borderColor: "var(--gold)" }}>
        <div className="flex justify-center text-ink"><Logo className="h-9" /></div>
        <p className="mt-6 text-sm uppercase tracking-[0.2em] text-gold-ink">Certificate of finishing</p>
        <p className="mt-6 text-muted">This celebrates</p>
        <p className="font-display text-3xl font-bold">{profile.display_name ?? "You"}</p>
        <p className="mt-4 text-muted">for finishing</p>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-4xl">{goal.title}</h1>
        <p className="mt-2 text-sm"><span aria-hidden>{area.icon} </span>{area.label}</p>
        <dl className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-3 text-sm">
          <div><dt className="text-muted">Started</dt><dd className="font-semibold">{formatDay(goal.start_date, long)}</dd></div>
          <div><dt className="text-muted">Finished</dt><dd className="font-semibold">{goal.finished_at ? formatDay(goal.finished_at.slice(0, 10), long) : "Soon"}</dd></div>
          <div><dt className="text-muted">Days shown up</dt><dd className="font-semibold">{days}</dd></div>
        </dl>
        <p className="mt-6 text-sm text-muted">{done} plan step{done === 1 ? "" : "s"} completed along the way.</p>
        {goal.why && <p className="mt-6 font-display italic">“{goal.why}”</p>}
        <p className="mt-10 font-fun text-lg font-black text-sage-ink">You did the thing.</p>
      </article>
    </div>
  );
}
