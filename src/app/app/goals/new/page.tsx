import Link from "next/link";
import { Button, ButtonLink, Card, Notice, PageHeader, inputCls } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listTemplates } from "@/lib/templates";
import { TONES } from "@/lib/tone";
import { AREAS, areaTint } from "@/lib/goals-core/areas";
import { createGoalFromBuilder } from "@/lib/goals-core/actions/goal";

export const metadata = { title: "New goal" };

const ERRORS: Record<string, React.ReactNode> = {
  title: "Give your goal a short sentence first.",
  limit: <>The free plan holds one active goal. Pause or finish it, or <Link href="/pricing" className="underline">upgrade</Link> for more.</>,
  save: "We couldn't save that. Please try again.",
};

export default async function NewGoalPage({ searchParams }: { searchParams: Promise<{ error?: string; area?: string }> }) {
  const { error, area: pickedArea } = await searchParams;
  const { supabase, user, profile } = await requireUser("/app/goals/new");
  const [templates, { data: lib }] = await Promise.all([
    listTemplates().catch(() => []),
    supabase.from("gk_library").select("template_id").eq("user_id", user.id),
  ]);
  const owned = new Set((lib ?? []).map((l) => l.template_id as string));
  const areas = pickedArea && AREAS.some((a) => a.id === pickedArea) ? AREAS.filter((a) => a.id === pickedArea) : AREAS;

  return (
    <div className="space-y-6">
      <PageHeader title="Start a new goal" sub="Pick a template for a guided setup, or write your own in a minute." />
      {error && ERRORS[error] && <Notice tone="warn">{ERRORS[error]}</Notice>}

      <Card>
        <h2 className="font-display text-xl font-bold">Quick start, your own words</h2>
        <form action={createGoalFromBuilder} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="mb-1 block text-sm font-semibold">Your goal in one sentence</span>
            <input name="title" required minLength={2} maxLength={140} className={inputCls} placeholder="Read 12 books this year" /></label>
          <label><span className="mb-1 block text-sm font-semibold">Area</span>
            <select name="area" className={inputCls} defaultValue={pickedArea ?? ""}>
              <option value="">Choose one</option>{AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select></label>
          <label><span className="mb-1 block text-sm font-semibold">Finish by (optional)</span><input type="date" name="finish_date" className={inputCls} /></label>
          <label><span className="mb-1 block text-sm font-semibold">Tracking</span>
            <select name="tracking_mode" className={inputCls} defaultValue="simple">
              <option value="simple">Simple: done, partly, missed</option><option value="detailed">Detailed: numbers too</option><option value="reflective">Reflective: a short note</option>
            </select></label>
          <label><span className="mb-1 block text-sm font-semibold">Tone</span>
            <select name="tone" className={inputCls} defaultValue={profile.default_tone}>{TONES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="sm:col-span-2"><span className="mb-1 block text-sm font-semibold">Why it matters (optional)</span>
            <textarea name="why" maxLength={1000} className={`${inputCls} min-h-20`} /></label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit">Create my plan</Button>
            <Link href="/onboarding?blank=1" className="text-sm underline">Prefer the playful guided setup?</Link>
          </div>
          <p className="text-xs text-muted sm:col-span-2">Your goal starts private. Health and money goals get a required safety step. The plan is a draft you can change.</p>
        </form>
      </Card>

      <section aria-labelledby="tpl">
        <h2 id="tpl" className="mb-3 font-display text-xl font-bold">Or start from a template</h2>
        <div className="space-y-5">
          {areas.map((a) => {
            const list = templates.filter((t) => t.area === a.id);
            if (!list.length) return null;
            return (
              <div key={a.id}>
                <h3 className="mb-2 font-semibold"><span aria-hidden>{a.icon} </span>{a.label}</h3>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((t) => {
                    const usable = t.tier === "Free" || owned.has(t.id) || t.creator_id === user.id;
                    return (
                      <li key={t.id} className="flex flex-col rounded-2xl border p-3" style={areaTint(a.accent, 8)}>
                        <p className="font-semibold">{t.name}</p>
                        <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">{t.summary}</p>
                        <p className="mt-2 text-xs font-semibold">{t.tier}{t.price ? ` · $${t.price}` : ""}{owned.has(t.id) ? " · In your library" : ""}</p>
                        <div className="mt-2">
                          {usable
                            ? <ButtonLink href={`/onboarding?template=${t.id}`} variant="secondary" className="w-full">Use this template</ButtonLink>
                            : <ButtonLink href={`/marketplace/${t.id}`} variant="ghost" className="w-full">See details</ButtonLink>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
