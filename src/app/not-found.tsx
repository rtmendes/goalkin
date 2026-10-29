import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";

// Kept free of data fetching so it renders even when nothing else works.
export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <Link href="/" aria-label="GoalKin home" className="text-ink"><Logo className="h-9" /></Link>
      <p aria-hidden className="mt-8 font-fun text-6xl font-black text-gold-ink">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold">This page wandered off its plan</h1>
      <p className="mt-2 text-muted">The link may be old or mistyped. Missing a step happens; let&apos;s get you back on track.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Go home</ButtonLink>
        <ButtonLink href="/marketplace" variant="secondary">Browse templates</ButtonLink>
      </div>
    </main>
  );
}
