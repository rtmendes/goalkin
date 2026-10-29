import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { ButtonLink, Card } from "@/components/ui";
import { Flash } from "@/components/people/flash";
import { SubmitButton } from "@/components/people/submit-button";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { circleInvitePreview, isCircleCode } from "@/lib/people/invites";
import { memberCount, namesFor, roleIn } from "@/lib/people/server";
import { TONES } from "@/lib/tone";
import type { Circle } from "@/lib/types";
import { joinByCode } from "./actions";

export const metadata: Metadata = { title: "Join a circle", robots: { index: false } };

const KIND: Record<Circle["kind"], string> = { pair: "Pair", group: "Group", club: "Club" };

export default async function JoinPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ n?: string }> }) {
  const { code } = await params;
  const { n } = await searchParams;
  if (!isCircleCode(code)) notFound();

  const { data } = await createAdminClient()
    .from("gk_circles")
    .select("id, owner_id, name, description, kind, tone, max_members")
    .eq("invite_code", code)
    .maybeSingle();
  const circle = data as Pick<Circle, "id" | "owner_id" | "name" | "description" | "kind" | "tone" | "max_members"> | null;

  const { user } = await getUser();
  const [names, count, myRole] = circle
    ? await Promise.all([namesFor([circle.owner_id]), memberCount(circle.id), user ? roleIn(circle.id, user.id) : Promise.resolve(null)])
    : [new Map<string, string>(), 0, null];
  const leader = circle ? names.get(circle.owner_id) ?? "The leader" : "";
  const preview = circle ? circleInvitePreview({ circleName: circle.name, leaderName: leader }) : null;
  const full = circle ? count >= circle.max_members : false;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link href="/" className="mb-6 inline-block text-ink"><Logo /></Link>
      <main id="main">
        <Flash code={n} />
        {!circle || !preview ? (
          <Card>
            <h1 className="font-display text-2xl font-bold">This invite link doesn&apos;t work</h1>
            <p className="mt-2 text-muted">It may have been replaced with a new one. Ask the person who sent it for a fresh link.</p>
          </Card>
        ) : (
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-muted">You&apos;re invited to join</p>
              <h1 className="font-display text-3xl font-bold">{circle.name}</h1>
              <p className="mt-1 text-sm text-muted">
                {KIND[circle.kind]} · led by <span className="font-semibold text-ink">{leader}</span> · {count} member{count === 1 ? "" : "s"} · {TONES.find((t) => t.id === circle.tone)?.name ?? "Coach"} tone
              </p>
              {circle.description && <p className="mt-3">{circle.description}</p>}
            </div>
            <section aria-labelledby="shares" className="rounded-xl border border-line bg-surface-2 p-3">
              <h2 id="shares" className="font-semibold">What joining shares</h2>
              <p className="mt-1">{preview.shares}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {preview.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </section>
            {myRole ? (
              <ButtonLink href={`/app/circles/${circle.id}`}>You&apos;re already in. Open the circle</ButtonLink>
            ) : full ? (
              <p role="note" className="font-semibold">This circle is full right now. Ask {leader} to make room.</p>
            ) : (
              <form action={joinByCode.bind(null, code)}>
                <SubmitButton pendingText="Joining…" className="w-full">{user ? "Join this circle" : "Sign in to join"}</SubmitButton>
              </form>
            )}
            <p className="text-sm"><Link href="/" className="underline">Not now</Link></p>
          </Card>
        )}
      </main>
    </div>
  );
}
