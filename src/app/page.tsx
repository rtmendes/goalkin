import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader, START_HREF } from "@/components/site/site-shell";
import { VisibilityDemo } from "@/components/site/visibility-demo";
import { RingBadge } from "@/components/marketplace/ring-badge";
import { ButtonLink, Card } from "@/components/ui";
import { TONES } from "@/lib/tone";
import { PLANS } from "@/lib/entitlements";
import { RINGS } from "@/lib/visibility";
import { PROGRAMS } from "@/lib/commerce/products";
import { AREAS } from "@/lib/marketplace/template-schema";
import { readCatalog, type CatalogEntry } from "@/lib/templates";
import type { Visibility } from "@/lib/types";

export const metadata: Metadata = {
  title: { absolute: "GoalKin · Your goal, with someone in your corner" },
  description: "Your goal, on your calendar, with someone in your corner, in the tone you choose. Private by default; share exactly what you pick.",
};

const STEPS = [
  { n: 1, title: "Say the goal", body: "One sentence is enough. GoalKin offers three sharper versions; keep yours if you like it better." },
  { n: 2, title: "Answer a few playful questions", body: "How you work, how ready you feel, how much time you have. Skip anything." },
  { n: 3, title: "Get a plan on your calendar", body: "A dated plan with weekly checkpoints lands in a \"Goals\" calendar. The AI drafts it; you edit, remove or add anything." },
  { n: 4, title: "Check in, with your people", body: "Tap done, partly or missed. The people in your corner see only what you switch on." },
];

const RING_TEXT: Record<Visibility, string> = {
  private: "Only you. Every goal and every number starts here.",
  chosen: "A partner, a friend, a parent. People you pick one by one.",
  circle: "Your group, club or family circle.",
  public: "Anyone with your share link. Nothing goes public unless you choose it.",
};

const FAQ = [
  { q: "Who can see my goals?", a: "Nobody but you, until you choose otherwise. Each goal has a ring (Private, Chosen people, Circle, Public) and each number has its own switch. Before anything is shared you see a preview of exactly what others will see." },
  { q: "Is the plan written by AI?", a: "The AI drafts it from your answers and a proven template. You decide: every step can be edited, moved or removed, and you can add your own." },
  { q: "Do I need Google Calendar?", a: "No. You can subscribe to a calendar feed from any calendar app. If you connect Google, GoalKin only uses a separate \"Goals\" calendar it creates; it does not read your other calendars." },
  { q: "Is this medical or financial advice?", a: "No. GoalKin offers education and structure, not medical or financial advice, and it never promises results. Health, diet and supplement plans start with a \"talk to your doctor\" step." },
  { q: "What does Free include?", a: "One active goal, starter templates, Private plus one chosen person, email and push reminders, and a calendar feed. No credit card." },
  { q: "What if I miss a few days?", a: "Missing a day never erases progress. You get a gentle restart plan sized to how long you were away." },
];

function daysLeftInYear(now = new Date()) {
  const end = Date.UTC(now.getUTCFullYear(), 11, 31);
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

async function catalogByArea(): Promise<Record<string, CatalogEntry[]>> {
  try {
    const all = await readCatalog();
    return Object.fromEntries(AREAS.map((a) => [a, all.filter((t) => t.area === a)]));
  } catch {
    return {};
  }
}

export default async function Home() {
  const byArea = await catalogByArea();
  const daysLeft = daysLeftInYear();
  const fty = PROGRAMS["finish-the-year"];
  const year = new Date().getUTCFullYear();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:py-16 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm">
              <b className="text-coral-ink">Finish {year}</b>
              <span className="text-muted">{daysLeft} days left in the year</span>
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
              Your goal, on your calendar, with someone in your corner, <em className="text-sage-ink">in the tone you choose.</em>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted">
              GoalKin turns a goal into a plan you can follow, puts it on your calendar, and lets the people in your corner see exactly as much as you choose.
              Run a first 5K, read the Bible in a year, finish the book. Alone, with one friend, or with your whole club.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href={START_HREF} className="px-6 text-base">Start your first goal</ButtonLink>
              <ButtonLink href="#rings" variant="secondary" className="px-6 text-base">See how sharing works</ButtonLink>
            </div>
            <p className="mt-3 text-sm text-muted">Free for one goal. No credit card. Private by default.</p>
          </div>

          <figure aria-label="Example GoalKin screen" className="mx-auto w-full max-w-sm">
            <div className="rounded-[2rem] border border-line bg-surface p-4 shadow-lg">
              <div className="flex items-center justify-between text-xs text-muted"><span>Thursday</span><span>Today</span></div>
              <p className="mt-2 font-display text-xl font-bold">Today&apos;s goals</p>
              <div className="mt-3 rounded-2xl border border-line bg-surface-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">First 5K</p>
                    <p className="text-xs text-muted">Week 4 of 9 · run 25 min</p>
                  </div>
                  <span className="rounded-full bg-sage/15 px-2 py-0.5 text-xs font-semibold text-sage-ink"><span aria-hidden>✓ </span>On track</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <RingBadge ring="circle" />
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold"><span aria-hidden>🔒</span>Pace: only me</span>
                </div>
                <ol className="mt-3 grid grid-cols-7 gap-1 text-center text-xs" aria-label="This week">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <li key={i} className={`rounded-lg py-1 ${i < 3 ? "bg-sage text-white" : i === 3 ? "border-2 border-coral" : "bg-surface"}`}>
                      {d}
                      <span aria-hidden className="block">{i < 3 ? "✓" : i === 3 ? "•" : " "}</span>
                      <span className="sr-only">{i < 3 ? "done" : i === 3 ? "today" : "upcoming"}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="mt-3 rounded-2xl border border-line p-3 text-sm">
                <p className="font-semibold">Jordan · chosen person</p>
                <p className="text-muted">Saw your check-in. Saturday run together?</p>
              </div>
              <p className="mt-3 rounded-xl bg-navy px-3 py-2 text-xs text-[#F7F3EC]"><span aria-hidden>📅 </span>Thursday&apos;s run added to your Goals calendar</p>
            </div>
            <figcaption className="mt-2 text-center text-xs text-muted">Example screen with made-up names.</figcaption>
          </figure>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-line bg-surface py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-ink">How it works</p>
            <h2 className="mt-1 font-display text-3xl font-bold">From one sentence to a plan on your calendar</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-2xl border border-line bg-bg p-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-navy font-fun font-black text-[#F7F3EC] dark:bg-gold dark:text-navy">{s.n}</span>
                  <h3 className="mt-3 font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Visibility rings */}
        <section id="rings" className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:py-16 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-ink">You decide who sees what</p>
            <h2 className="mt-1 font-display text-3xl font-bold">Build in private. <em className="text-sage-ink">Share on purpose.</em></h2>
            <p className="mt-3 text-muted">Every goal keeps full detail for you. Pick a ring for each goal, then switch each number on or off. Your run club can see &ldquo;on track, 71%&rdquo; while your weight stays yours.</p>
            <ul className="mt-5 space-y-3">
              {RINGS.map((r) => (
                <li key={r} className="flex items-start gap-3">
                  <RingBadge ring={r} className="mt-0.5 shrink-0" />
                  <span className="text-sm">{RING_TEXT[r]}</span>
                </li>
              ))}
            </ul>
          </div>
          <VisibilityDemo />
        </section>

        {/* Tone modes */}
        <section className="border-y border-line bg-surface py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-ink">Tone modes</p>
            <h2 className="mt-1 font-display text-3xl font-bold">Reminders in the voice that works on you</h2>
            <p className="mt-2 max-w-2xl text-muted">Pick a tone per goal. Change it any time. Here&apos;s how the same reminder sounds in each.</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TONES.map((t) => (
                <li key={t.id} className="flex flex-col rounded-2xl border border-line bg-bg p-4">
                  <h3 className="font-fun text-lg font-black">{t.name}</h3>
                  <p className="text-sm text-muted">{t.blurb}</p>
                  <blockquote className="mt-3 flex-1 rounded-xl bg-surface p-3 text-sm">&ldquo;{t.sample}&rdquo;</blockquote>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Template areas */}
        <section id="templates" className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-gold-ink">Template marketplace</p>
          <h2 className="mt-1 font-display text-3xl font-bold">Start from a plan someone already proved</h2>
          <p className="mt-2 max-w-2xl text-muted">Free starter templates, premium programs, and plans from coaches, pastors and club leaders. The AI fits each one to your dates and your week.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AREAS.map((area) => (
              <li key={area}>
                <Link href={`/marketplace?area=${encodeURIComponent(area)}`} className="block h-full rounded-2xl border border-line bg-surface p-4 hover:border-sage">
                  <h3 className="font-semibold">{area}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {(byArea[area] ?? []).slice(0, 3).map((t) => t.name).join(" · ") || "Templates coming soon"}
                  </p>
                  <span className="mt-2 inline-block text-sm font-semibold text-sage-ink">Browse <span aria-hidden>→</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Finish the Year */}
        <section aria-labelledby="fty" className="px-4">
          <div className="mx-auto max-w-6xl rounded-3xl bg-navy p-6 text-[#F7F3EC] sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-wide text-gold">Premium program · {fty.window}</p>
            <h2 id="fty" className="mt-1 font-display text-3xl font-bold">Finish the Year. <em className="text-gold">Finish one thing.</em></h2>
            <p className="mt-3 max-w-2xl text-[#E6E1D6]">{fty.summary} Runs {fty.window}, ${fty.price} one time. Pick the goal, invite one person, and let the plan land on your calendar tonight.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={START_HREF} className="inline-flex min-h-11 items-center rounded-xl bg-gold px-5 font-semibold text-navy hover:opacity-90">Start free today</Link>
              <Link href="/pricing#programs" className="inline-flex min-h-11 items-center rounded-xl border border-[#F7F3EC]/40 px-5 font-semibold hover:bg-white/10">See the program</Link>
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section id="pricing" className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-gold-ink">Pricing</p>
          <h2 className="mt-1 font-display text-3xl font-bold">Start free. Bring your people when you&apos;re ready.</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <li key={p.id}>
                <Card className={p.id === "pro" ? "h-full border-2 border-sage" : "h-full"}>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="mt-1 font-display text-2xl font-bold">{p.price}</p>
                  <p className="text-sm text-muted">{p.who}</p>
                  <ul className="mt-3 space-y-1 text-sm">
                    {p.features.slice(0, 3).map((f) => <li key={f}><span aria-hidden className="text-sage-ink">✓ </span>{f}</li>)}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
          <p className="mt-4"><Link href="/pricing" className="font-semibold text-sage-ink underline underline-offset-4">Compare plans and programs</Link></p>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq" className="border-t border-line bg-surface py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 id="faq" className="font-display text-3xl font-bold">Questions</h2>
            <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-bg">
              {FAQ.map((f) => (
                <details key={f.q} className="group p-4">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                    {f.q}
                    <span aria-hidden className="text-muted group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-muted">{f.a}</p>
                </details>
              ))}
            </div>
            <div className="mt-8 text-center">
              <ButtonLink href={START_HREF} className="px-6 text-base">Start your first goal</ButtonLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
