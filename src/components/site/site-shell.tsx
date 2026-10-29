import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ButtonLink, cx } from "@/components/ui";
import { optionalUser } from "@/lib/site/session";

export const START_HREF = "/login?next=/onboarding";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/marketplace", label: "Templates" },
  { href: "/pricing", label: "Pricing" },
  { href: "/creators", label: "Creators" },
];

export async function SiteHeader() {
  const session = await optionalUser();
  return (
    <header className="border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="flex min-h-11 items-center text-ink" aria-label="GoalKin home">
          <Logo className="h-8" />
        </Link>
        <nav aria-label="Site" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex flex-wrap gap-x-1 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-muted hover:bg-surface-2 hover:text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><ThemeToggle /></div>
          {session ? (
            <ButtonLink href="/app">Open GoalKin</ButtonLink>
          ) : (
            <>
              <Link href="/login" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline-offset-4 hover:underline">Sign in</Link>
              <ButtonLink href={START_HREF}>Start free</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Logo className="h-7 text-ink" />
          <p className="max-w-sm text-muted">Your goal, on your calendar, with someone in your corner, in the tone you choose.</p>
          <p className="text-muted">Plans are suggestions you control. GoalKin offers education, not medical or financial advice.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
            {[
              ["/marketplace", "Templates"], ["/pricing", "Pricing"], ["/creators", "Creators"], ["/login", "Sign in"],
              ["/legal/terms", "Terms"], ["/legal/privacy", "Privacy"], ["/legal/notices", "Notices and disclosures"],
            ].map(([href, label]) => (
              <li key={href}><Link href={href} className="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-ink hover:underline">{label}</Link></li>
            ))}
          </ul>
          <div className="mt-2 sm:hidden"><ThemeToggle /></div>
        </nav>
      </div>
    </footer>
  );
}

/** Public page frame: header, main landmark (skip-link target), footer. */
export function SiteShell({ children, width = "wide" }: { children: ReactNode; width?: "wide" | "narrow" }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className={cx("mx-auto w-full flex-1 px-4 pt-6 sm:pt-10", width === "narrow" ? "max-w-3xl" : "max-w-6xl")}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
