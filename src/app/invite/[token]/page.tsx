import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { ButtonLink, Card, Notice } from "@/components/ui";
import { SharedViewBody } from "@/components/people/shared-view";
import { SubmitButton } from "@/components/people/submit-button";
import { getUser } from "@/lib/auth";
import { loadSharedGoal } from "@/lib/goals";
import { createAdminClient } from "@/lib/supabase/admin";
import { RING_LABEL } from "@/lib/visibility";
import { CIRCLE_JOIN_SHARES, isInviteToken, readInvitePreview } from "@/lib/people/invites";
import { namesFor } from "@/lib/people/server";
import type { Visibility } from "@/lib/types";
import { acceptInvite } from "./actions";

export const metadata: Metadata = { title: "Your invite", robots: { index: false } };

const MESSAGES: Record<string, [tone: "info" | "warn", text: string]> = {
  used: ["warn", "This invite was already used by someone else. Ask for a new one."],
  own: ["info", "This is your own invite. Send the link to the person you want in your corner."],
  gone: ["warn", "The goal or circle this invite was for no longer exists."],
  limit: ["warn", "The owner's plan allows one chosen person, and that spot is taken. They can upgrade or remove someone first."],
  full: ["warn", "This circle is full right now. Ask the leader to make room."],
  failed: ["warn", "That didn't work. Please try again in a moment."],
  accepted: ["info", "You're in their corner now. Thank you."],
  declined: ["info", "No problem. Nothing was shared and nothing changes."],
};

interface InviteRow {
  inviter_id: string;
  goal_id: string | null;
  circle_id: string | null;
  preview: unknown;
  accepted_by: string | null;
}

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ n?: string }> }) {
  const { token } = await params;
  const { n } = await searchParams;
  if (!isInviteToken(token)) notFound();

  const db = createAdminClient();
  const { data } = await db.from("gk_invites").select("inviter_id, goal_id, circle_id, preview, accepted_by").eq("token", token).maybeSingle();
  const invite = data as InviteRow | null;
  const { user } = await getUser();
  const message = n ? MESSAGES[n] : undefined;

  if (!invite) {
    return (
      <Shell>
        <Card>
          <h1 className="font-display text-2xl font-bold">This invite link doesn&apos;t work</h1>
          <p className="mt-2 text-muted">Check that you copied the whole link, or ask for a new one.</p>
        </Card>
      </Shell>
    );
  }

  const inviter = (await namesFor([invite.inviter_id])).get(invite.inviter_id) ?? "Someone";
  const preview = readInvitePreview(invite.preview);
  const declined = n === "declined";
  const acceptedByMe = !!user && invite.accepted_by === user.id;
  const usedByOther = !!invite.accepted_by && invite.accepted_by !== user?.id;

  // For goal invites: is the goal's card still Private? Then accepting records you, but you'll see nothing yet.
  let goalRing: Visibility | null = null;
  if (invite.goal_id) {
    const { data: g } = await db.from("gk_goals").select("visibility").eq("id", invite.goal_id).maybeSingle();
    goalRing = (g?.visibility as Visibility | undefined) ?? null;
  }
  const liveView = acceptedByMe && invite.goal_id ? await loadSharedGoal(invite.goal_id, user.id) : null;

  return (
    <Shell>
      {message && <div role="status" className="mb-4"><Notice tone={message[0]}>{message[1]}</Notice></div>}
      <Card className="space-y-4">
        <div>
          <p className="text-sm text-muted">An invite from</p>
          <h1 className="font-display text-3xl font-bold">{inviter}</h1>
          <p className="mt-1">
            {invite.circle_id && !invite.goal_id ? "wants you in their circle." : "wants you in their corner for a goal."}
          </p>
        </div>

        <section aria-labelledby="what" className="rounded-xl border border-line bg-surface-2 p-3">
          <h2 id="what" className="font-semibold">{acceptedByMe && invite.goal_id ? "What you can see now" : "Exactly what you'll see"}</h2>
          <div className="mt-2">
            {acceptedByMe && invite.goal_id ? (
              liveView ? (
                <>
                  <p className="mb-2 font-semibold">{liveView.title}</p>
                  <SharedViewBody view={liveView} />
                </>
              ) : (
                <p>Nothing yet. {inviter} keeps this goal private for now. You&apos;ll see it as soon as they choose to share it with you.</p>
              )
            ) : preview.type === "circle" ? (
              <>
                {preview.preview.circle_name && <p className="mb-1 font-semibold">{preview.preview.circle_name}</p>}
                <p>{preview.preview.shares ?? CIRCLE_JOIN_SHARES}</p>
                {preview.preview.points && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                    {preview.preview.points.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                )}
              </>
            ) : preview.type === "goal" ? (
              <>
                <p className="mb-2 font-semibold">{preview.view.title}</p>
                {preview.ring && preview.ring in RING_LABEL && <p className="mb-2 text-xs text-muted">Shared as: {RING_LABEL[preview.ring as Visibility]}</p>}
                {preview.note && <p className="mb-2 italic">“{preview.note}”</p>}
                <SharedViewBody view={preview.view} />
                <p className="mt-2 text-xs text-muted">This is a snapshot from when the invite was sent. You&apos;ll see live updates once you accept, limited to what {inviter} chooses to share.</p>
              </>
            ) : (
              <p>{invite.circle_id ? CIRCLE_JOIN_SHARES : `Only what ${inviter} chooses to share with you. Nothing is shared yet.`}</p>
            )}
          </div>
        </section>

        {invite.goal_id && goalRing === "private" && !declined && (
          <Notice>
            Right now {inviter} keeps this goal private, so accepting won&apos;t show you anything yet. You&apos;ll be on their list, and you&apos;ll see whatever they share once they open it up.
          </Notice>
        )}

        {declined ? (
          <ButtonLink href="/" variant="secondary">Back to GoalKin</ButtonLink>
        ) : usedByOther ? (
          <p className="font-semibold">This invite has already been used.</p>
        ) : acceptedByMe ? (
          <ButtonLink href={invite.circle_id && !invite.goal_id ? `/app/circles/${invite.circle_id}` : "/app"}>Go to GoalKin</ButtonLink>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <form action={acceptInvite.bind(null, token)}>
              <SubmitButton pendingText="Accepting…">{user ? "Accept invite" : "Sign in to accept"}</SubmitButton>
            </form>
            <Link href={`/invite/${token}?n=declined`} className="inline-flex min-h-11 items-center px-2 underline">Decline</Link>
          </div>
        )}
        {invite.goal_id && <p className="text-xs text-muted">Accepting doesn&apos;t share anything of yours. Your own goals stay private unless you choose.</p>}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link href="/" className="mb-6 inline-block text-ink"><Logo /></Link>
      <main id="main">{children}</main>
    </div>
  );
}
