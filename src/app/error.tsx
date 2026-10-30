"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  return (
    <main id="main" className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p aria-hidden className="font-fun text-5xl font-black text-coral-ink">Oops</p>
      <h1 className="mt-2 font-display text-3xl font-bold">Something went sideways</h1>
      <p className="mt-2 text-muted">That&apos;s on us, not you. Your goals and check-ins are safe. Try again, or head home.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => retry()}>Try again</Button>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2">Go home</Link>
      </div>
      {digest && <p className="mt-6 text-xs text-muted">Reference: {digest}</p>}
    </main>
  );
}
