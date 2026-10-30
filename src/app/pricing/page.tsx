import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell, START_HREF } from "@/components/site/site-shell";
import { CheckoutButton } from "@/components/site/checkout-button";
import { ProToggle } from "@/components/site/pro-toggle";
import { ButtonLink, Card, Notice, cx } from "@/components/ui";
import { PLANS } from "@/lib/entitlements";
import { serverEnv } from "@/lib/env";
import { checkoutHref } from "@/lib/commerce/checkout";
import { PROGRAMS } from "@/lib/commerce/products";
import { optionalUser } from "@/lib/site/session";

export const metadata: Metadata = { title: "Pricing", description: "Start free. Pro, Circle and Club plans, plus $37 seasonal programs." };

export default async function PricingPage() {
  const session = await optionalUser();
  const email = session?.user.email ?? null;
  const urls = serverEnv().checkout;
  const href = (key: string) => checkoutHref(urls[key], email);

  return (
    <SiteShell>
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Start free. Bring your people when you&apos;re ready.</h1>
        <p className="mt-2 text-muted">Every plan keeps your goals private by default. Upgrade when you want more goals, more people, or a group to lead.</p>
      </header>

      <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <li key={p.id}>
            <Card className={cx("flex h-full flex-col", p.id === "pro" && "border-2 border-sage")}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{p.name}</h2>
                {p.id === "pro" && <span className="rounded-full bg-sage/15 px-2 py-0.5 text-xs font-semibold text-sage-ink"><span aria-hidden>★ </span>Most picked</span>}
              </div>
              <p className="text-sm text-muted">{p.who}</p>
              {p.id !== "pro" && <p className="mt-3 font-display text-3xl font-bold">{p.price.replace("/mo", "")}<span className="text-base font-normal text-muted">{p.id === "free" ? " forever" : " a month"}</span></p>}
              {p.id === "pro" && <div className="mt-3"><ProToggle monthlyHref={href("pro_monthly")} yearlyHref={href("pro_yearly")} /></div>}
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                {p.features.map((f) => <li key={f}><span aria-hidden className="text-sage-ink">✓ </span>{f}</li>)}
              </ul>
              <div className="mt-4">
                {p.id === "free" && (session ? <ButtonLink href="/app" variant="secondary" className="w-full">Open GoalKin</ButtonLink> : <ButtonLink href={START_HREF} variant="secondary" className="w-full">Start free</ButtonLink>)}
                {(p.id === "circle" || p.id === "club") && <CheckoutButton href={href(p.id)} label={`Get ${p.name}`} variant="secondary" />}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <section id="programs" aria-labelledby="programs-h" className="mt-14">
        <h2 id="programs-h" className="font-display text-2xl font-bold">Premium programs</h2>
        <p className="mt-1 max-w-2xl text-muted">Guided seasonal programs: a template, all tone modes and one partner. Pay once; the program stays in your library and you can run it again.</p>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {Object.entries(PROGRAMS).map(([id, prog]) => (
            <li key={id}>
              <Card className="flex h-full flex-col">
                <p className="text-sm font-semibold text-gold-ink"><span aria-hidden>★ </span>Premium · {prog.window}</p>
                <h3 className="mt-1 text-xl font-semibold">{prog.name}</h3>
                <p className="mt-1 flex-1 text-muted">{prog.summary}</p>
                <p className="mt-3 font-display text-3xl font-bold">${prog.price}<span className="text-base font-normal text-muted"> one time</span></p>
                <div className="mt-3"><CheckoutButton href={href(prog.checkoutKey)} label={`Get ${prog.name}`} /></div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 max-w-2xl space-y-3 text-sm text-muted">
        <Notice>
          Checkout is handled by our payment processor (GoHighLevel). {email ? <>We&apos;ll fill in <b className="text-ink">{email}</b> so your purchase unlocks this account.</> : <>Use the same email you sign in with so your purchase unlocks your account. <Link className="underline" href="/login?next=/pricing">Sign in first</Link> to fill it in for you.</>}
        </Notice>
        <p>Plans renew until you cancel. Prices in US dollars. Programs and templates are plans and education, not medical or financial advice, and results depend on you. See the <Link className="underline" href="/legal/terms">Terms</Link>.</p>
      </div>
    </SiteShell>
  );
}
