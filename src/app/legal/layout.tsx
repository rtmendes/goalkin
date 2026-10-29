import Link from "next/link";
import { SiteShell } from "@/components/site/site-shell";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell width="narrow">
      <p role="note" className="mb-6 rounded-xl border-2 border-gold bg-gold/10 px-4 py-3 text-sm">
        <b><span aria-hidden>⚠ </span>Draft, pending legal review.</b> This plain-English draft explains how GoalKin works today. Bracketed items like [Company legal name] will be filled in before launch.
      </p>
      <nav aria-label="Legal pages" className="mb-6 flex flex-wrap gap-x-4 text-sm">
        <Link className="inline-flex min-h-11 items-center underline" href="/legal/terms">Terms</Link>
        <Link className="inline-flex min-h-11 items-center underline" href="/legal/privacy">Privacy</Link>
        <Link className="inline-flex min-h-11 items-center underline" href="/legal/notices">Notices and disclosures</Link>
      </nav>
      <article className="legal space-y-4 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:underline">
        {children}
      </article>
    </SiteShell>
  );
}
