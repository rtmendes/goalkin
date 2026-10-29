import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { SharedGoalCard } from "@/components/goals/shared-goal-card";
import { loadPublicGoal } from "@/lib/goals";
import { env } from "@/lib/env";
import type { SharedGoalView } from "@/lib/visibility";

async function load(token: string): Promise<SharedGoalView | null> {
  try {
    return await loadPublicGoal(token);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const view = await load(token);
  if (!view) return { title: "Goal not found", robots: { index: false } };
  const description = view.percent !== undefined ? `${view.percent}% of the way there, on GoalKin.` : "Following along on GoalKin.";
  const image = `${env.appUrl}/api/og/${token}`;
  return {
    title: view.title,
    description,
    robots: { index: false },
    openGraph: { title: view.title, description, images: [{ url: image, width: 1200, height: 630, alt: `Share card for ${view.title}` }], type: "website" },
    twitter: { card: "summary_large_image", title: view.title, description, images: [image] },
  };
}

export default async function PublicGoalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await load(token);
  if (!view) notFound();
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-ink"><Logo className="h-7" /></Link>
        <span className="text-xs text-muted">Shared goal</span>
      </header>
      <main id="main" className="flex-1">
        <SharedGoalCard view={view} headingLevel={2} className="shadow-sm" />
        <p className="mt-3 text-xs text-muted">The owner chose what appears here. Everything else stays private.</p>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-4 text-center">
          <p className="font-display text-lg font-bold">Have a goal of your own?</p>
          <p className="mt-1 text-sm text-muted">Put it on your calendar, with someone in your corner, in the tone you choose.</p>
          <Link href="/" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-navy px-4 font-semibold text-[#F7F3EC] dark:bg-gold dark:text-navy">Try GoalKin free</Link>
        </div>
      </main>
    </div>
  );
}
