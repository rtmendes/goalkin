import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, ButtonLink, Card, Empty, Field, Input, Notice, PageHeader, Select, Textarea } from "@/components/ui";
import { CopyButton } from "@/components/people/copy-button";
import { EncourageComposer } from "@/components/people/encourage-composer";
import { Flash } from "@/components/people/flash";
import { ReactionRow } from "@/components/people/reaction-row";
import { SharedViewBody } from "@/components/people/shared-view";
import { SubmitButton } from "@/components/people/submit-button";
import { VoiceRecorder } from "@/components/people/voice-recorder";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { loadSharedGoal } from "@/lib/goals";
import { MISSED_DAY_ENCOURAGEMENTS, TONES } from "@/lib/tone";
import { loadLayers, signVoice, type FeedItem, type Layer } from "@/lib/people/circle-data";
import { CIRCLE_JOIN_SHARES } from "@/lib/people/invites";
import { daysSinceLastCheckIn } from "@/lib/people/quiet";
import { loadCircleAdmin, membersOf, roleIn } from "@/lib/people/server";
import { formatWhen, hoursAgoIso } from "@/lib/people/time";
import type { Circle } from "@/lib/types";
import {
  addMyLayer,
  attachSharedGoal,
  createMeetup,
  createSharedGoal,
  deleteCircle,
  deleteMeetup,
  inviteByEmail,
  leaveCircle,
  proposeDare,
  regenerateInviteCode,
  removeMember,
  sendNote,
  sendReaction,
  sendVoiceNote,
} from "../actions";

export const metadata: Metadata = { title: "Circle" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KIND_LABEL: Record<Circle["kind"], string> = { pair: "Pair", group: "Group", club: "Club" };

interface Meetup { id: string; title: string; starts_at: string; duration_min: number; link: string | null; created_by: string }
interface EncRow { id: string; from_id: string; to_id: string | null; kind: FeedItem["kind"]; body: string | null; media_url: string | null; created_at: string }

export default async function CirclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ n?: string; nudge?: string }> }) {
  const { id } = await params;
  const { n, nudge } = await searchParams;
  if (!UUID.test(id)) notFound();
  const { supabase, user, profile } = await requireUser(`/app/circles/${id}`);

  const [circle, role] = await Promise.all([loadCircleAdmin(id), roleIn(id, user.id)]);
  if (!circle) notFound();
  const isLeader = circle.owner_id === user.id;
  if (!role && !isLeader) notFound();

  const members = await membersOf(id);
  const nameOf = new Map(members.map((m) => [m.user_id, m.name]));
  const others = members.filter((m) => m.user_id !== user.id);

  const sharedView = circle.shared_goal_id ? await loadSharedGoal(circle.shared_goal_id, user.id) : null;
  const layers = circle.shared_goal_id ? await loadLayers({ circleId: id, sharedGoalId: circle.shared_goal_id, viewerId: user.id, members }) : [];
  const myLayer = layers.find((l) => l.mine);

  const nowIso = hoursAgoIso(2);
  const [{ data: encData }, { data: meetData }, { data: inviteData }, { data: myGoals }] = await Promise.all([
    supabase.from("gk_encouragements").select("id, from_id, to_id, kind, body, media_url, created_at").eq("circle_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("gk_meetups").select("id, title, starts_at, duration_min, link, created_by").eq("circle_id", id).gte("starts_at", nowIso).order("starts_at").limit(20),
    supabase.from("gk_invites").select("email, token, created_at").eq("circle_id", id).eq("inviter_id", user.id).is("accepted_at", null).order("created_at", { ascending: false }).limit(20),
    isLeader && !circle.shared_goal_id
      ? supabase.from("gk_goals").select("id, title").eq("owner_id", user.id).is("parent_goal_id", null).in("status", ["draft", "active", "paused"]).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const encRows = (encData ?? []) as EncRow[];
  const audio = await signVoice(encRows.filter((e) => e.kind === "voice"));
  const feed: FeedItem[] = encRows.map((e) => ({
    id: e.id,
    kind: e.kind,
    body: e.body,
    fromName: e.from_id === user.id ? "You" : nameOf.get(e.from_id) ?? "A former member",
    toName: e.to_id ? (e.to_id === user.id ? "you" : nameOf.get(e.to_id) ?? "a former member") : null,
    mine: e.from_id === user.id,
    created_at: e.created_at,
    audioUrl: e.media_url ? audio.get(e.media_url) ?? null : null,
  }));
  const meetups = (meetData ?? []) as Meetup[];
  const invites = (inviteData ?? []) as { email: string | null; token: string }[];

  const appUrl = env.appUrl.replace(/\/$/, "");
  const joinUrl = `${appUrl}/join/${circle.invite_code}`;
  const tone = TONES.find((t) => t.id === circle.tone);

  const nudgeTarget = nudge && others.some((m) => m.user_id === nudge) ? nudge : "";
  const nudgeText = nudgeTarget ? `Hey ${nameOf.get(nudgeTarget)}, ${MISSED_DAY_ENCOURAGEMENTS[1].charAt(0).toLowerCase()}${MISSED_DAY_ENCOURAGEMENTS[1].slice(1)}` : "";

  const bound = {
    note: sendNote.bind(null, id),
    reaction: sendReaction.bind(null, id),
    voice: sendVoiceNote.bind(null, id),
    dare: proposeDare.bind(null, id),
  };

  return (
    <div className="space-y-6">
      <p className="text-sm"><Link href="/app/circles" className="underline">← All circles</Link></p>
      <PageHeader
        title={circle.name}
        sub={<>{KIND_LABEL[circle.kind]} · {members.length} of {circle.max_members} · {tone?.name ?? "Coach"} tone{isLeader ? " · You lead" : ""}</>}
      />
      <Flash code={n} />
      {circle.description && <p>{circle.description}</p>}
      {circle.program && (
        <details className="rounded-2xl border border-line bg-surface p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">The program</summary>
          <p className="whitespace-pre-line">{circle.program}</p>
        </details>
      )}

      {/* Shared goal and member layers */}
      <Card id="shared" aria-labelledby="shared-h" className="scroll-mt-4 space-y-4">
        <h2 id="shared-h" className="font-display text-xl font-bold">Shared goal</h2>
        {!circle.shared_goal_id ? (
          isLeader ? (
            <div className="space-y-5">
              <p className="text-muted">Give the circle one goal to work toward. Each member can add their own layer under it and choose what the circle sees.</p>
              <form action={createSharedGoal.bind(null, id)} className="space-y-3">
                <Field label="Shared goal" id="sg-title">
                  <Input id="sg-title" name="title" required maxLength={140} placeholder="Everyone finishes the spring 10K" />
                </Field>
                <Field label="Finish date (optional)" id="sg-date">
                  <Input id="sg-date" name="finish_date" type="date" />
                </Field>
                <Notice>The circle will see this goal&apos;s title. Next, you&apos;ll choose which numbers they see, with a preview.</Notice>
                <SubmitButton pendingText="Creating…">Create shared goal</SubmitButton>
              </form>
              {(myGoals ?? []).length > 0 && (
                <form action={attachSharedGoal.bind(null, id)} className="space-y-3 border-t border-line pt-4">
                  <Field label="Or use one of your goals" id="sg-attach" hint="Its card becomes visible to the circle. You choose which numbers on the next screen.">
                    <Select id="sg-attach" name="goal_id" required defaultValue="">
                      <option value="" disabled>Pick a goal</option>
                      {(myGoals ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                    </Select>
                  </Field>
                  <SubmitButton variant="secondary" pendingText="Saving…">Use this goal</SubmitButton>
                </form>
              )}
            </div>
          ) : (
            <Empty title="No shared goal yet">The leader can set one. You can still cheer each other on below.</Empty>
          )
        ) : (
          <>
            <div className="rounded-xl bg-surface-2 p-3">
              {sharedView ? (
                <>
                  <p className="mb-2 text-lg font-semibold">{sharedView.title}</p>
                  <SharedViewBody view={sharedView} />
                </>
              ) : (
                <p>The leader keeps the shared goal private for now.</p>
              )}
              {isLeader && (
                <ButtonLink href={`/app/goals/${circle.shared_goal_id}/share`} variant="secondary" className="mt-3">Choose what the circle sees</ButtonLink>
              )}
            </div>

            <h3 className="font-semibold">Member layers</h3>
            {layers.length === 0 && <p className="text-sm text-muted">No layers yet. Each member can track their own measures under the shared goal.</p>}
            <ul className="space-y-3">
              {layers.map((l) => (
                <LayerCard key={l.goalId} layer={l} reactionAction={bound.reaction} dareAction={bound.dare} circleId={id} />
              ))}
            </ul>

            {!myLayer && circle.owner_id !== user.id && (
              <form action={addMyLayer.bind(null, id)} className="space-y-3 border-t border-line pt-4">
                <Field label="Add my layer" id="layer-title" hint="Starts Private. Next, you choose what the circle sees, number by number.">
                  <Input id="layer-title" name="title" required maxLength={140} defaultValue={sharedView ? `My part: ${sharedView.title}` : "My part"} />
                </Field>
                <SubmitButton pendingText="Adding…">Add my layer</SubmitButton>
              </form>
            )}
          </>
        )}
      </Card>

      {/* Encouragement */}
      <Card id="encourage" aria-labelledby="enc-h" className="scroll-mt-4 space-y-4">
        <h2 id="enc-h" className="font-display text-xl font-bold">Encourage</h2>
        <EncourageComposer
          key={nudgeTarget || "all"}
          action={bound.note}
          templates={MISSED_DAY_ENCOURAGEMENTS}
          members={others.map((m) => ({ id: m.user_id, name: m.name }))}
          initialText={nudgeText}
          initialTo={nudgeTarget}
        />
        <div className="border-t border-line pt-4">
          <h3 className="mb-2 font-semibold">Quick reaction to everyone</h3>
          <ReactionRow action={bound.reaction} />
        </div>
        <div className="border-t border-line pt-4">
          <h3 className="mb-2 font-semibold">Voice note to the circle</h3>
          <VoiceRecorder userId={user.id} action={bound.voice} />
        </div>
      </Card>

      <Card id="feed" aria-labelledby="feed-h" className="scroll-mt-4">
        <h2 id="feed-h" className="mb-3 font-display text-xl font-bold">Circle feed</h2>
        {feed.length === 0 ? (
          <Empty title="Quiet so far">Be the first to say something kind.</Empty>
        ) : (
          <ul className="space-y-3">
            {feed.map((f) => (
              <li key={f.id} className="rounded-xl border border-line p-3">
                <p className="text-sm text-muted">
                  <span className="font-semibold text-ink">{f.fromName}</span>
                  {f.toName ? <> to <span className="font-semibold text-ink">{f.toName}</span></> : null}
                  {" · "}
                  <time dateTime={f.created_at}>{formatWhen(f.created_at, profile.timezone)}</time>
                </p>
                {f.kind === "voice" ? (
                  f.audioUrl ? <audio controls preload="none" src={f.audioUrl} className="mt-2 w-full" aria-label={`Voice note from ${f.fromName}`} /> : <p className="mt-1 text-sm text-muted">Voice note (not available right now)</p>
                ) : (
                  <p className={f.kind === "reaction" ? "mt-1 text-lg" : "mt-1 whitespace-pre-line"}>{f.body}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Meetups */}
      <Card id="meetups" aria-labelledby="meet-h" className="scroll-mt-4 space-y-4">
        <h2 id="meet-h" className="font-display text-xl font-bold">Meetups</h2>
        {meetups.length === 0 ? (
          <p className="text-muted">No meetups planned.</p>
        ) : (
          <ul className="space-y-3">
            {meetups.map((m) => (
              <li key={m.id} className="rounded-xl border border-line p-3">
                <p className="font-semibold">{m.title}</p>
                <p className="text-sm text-muted">{formatWhen(m.starts_at, profile.timezone)} · {m.duration_min} min</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.link && /^https?:\/\//.test(m.link) && (
                    <a href={m.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-semibold">Join link<span className="sr-only"> for {m.title} (opens in a new tab)</span></a>
                  )}
                  <a href={`/app/circles/${id}/meetups/${m.id}/ics`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-semibold">Add to calendar (.ics)<span className="sr-only"> for {m.title}</span></a>
                  {(m.created_by === user.id || isLeader) && (
                    <form action={deleteMeetup.bind(null, id)}>
                      <input type="hidden" name="meetup_id" value={m.id} />
                      <Button type="submit" variant="ghost">Remove<span className="sr-only"> {m.title}</span></Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <form action={createMeetup.bind(null, id)} className="space-y-3 border-t border-line pt-4">
          <h3 className="font-semibold">Plan a meetup</h3>
          <Field label="Title" id="m-title">
            <Input id="m-title" name="title" required maxLength={120} placeholder="Sunday check-in" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts" id="m-start" hint={`Your time zone: ${profile.timezone}`}>
              <Input id="m-start" name="starts_at" type="datetime-local" required />
            </Field>
            <Field label="Length (minutes)" id="m-dur">
              <Input id="m-dur" name="duration_min" type="number" min={5} max={480} step={5} defaultValue={30} required />
            </Field>
          </div>
          <Field label="Video link (optional)" id="m-link">
            <Input id="m-link" name="link" type="url" maxLength={500} placeholder="https://" />
          </Field>
          <SubmitButton pendingText="Adding…">Add meetup</SubmitButton>
        </form>
      </Card>

      {/* Invites */}
      <Card id="invite" aria-labelledby="inv-h" className="scroll-mt-4 space-y-4">
        <h2 id="inv-h" className="font-display text-xl font-bold">Invite people</h2>
        <Notice>{CIRCLE_JOIN_SHARES}</Notice>
        <div>
          <p className="mb-1 text-sm font-semibold" id="join-link-label">Invite link</p>
          <p className="break-all rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm" aria-labelledby="join-link-label">{joinUrl}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton text={joinUrl} />
            {isLeader && (
              <form action={regenerateInviteCode.bind(null, id)}>
                <SubmitButton variant="ghost" pendingText="Making a new link…">Make a new link</SubmitButton>
              </form>
            )}
          </div>
          {isLeader && <p className="mt-1 text-xs text-muted">A new link stops the old one from working.</p>}
        </div>
        <form action={inviteByEmail.bind(null, id)} className="space-y-3 border-t border-line pt-4">
          <Field label="Invite by email" id="inv-email" hint="We make a personal invite link for them. Copy it below and send it however you like.">
            <Input id="inv-email" name="email" type="email" required autoComplete="off" placeholder="friend@example.com" />
          </Field>
          <SubmitButton variant="secondary" pendingText="Making invite…">Make invite</SubmitButton>
        </form>
        {invites.length > 0 && (
          <div>
            <h3 className="mb-2 font-semibold">Your pending invites</h3>
            <ul className="space-y-2">
              {invites.map((i) => (
                <li key={i.token} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-2">
                  <span className="break-all text-sm">{i.email ?? "Invite link"}</span>
                  <CopyButton text={`${appUrl}/invite/${i.token}`} label="Copy link" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Members */}
      <Card id="members" aria-labelledby="mem-h" className="scroll-mt-4 space-y-3">
        <h2 id="mem-h" className="font-display text-xl font-bold">Members</h2>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-semibold">{m.user_id === user.id ? `${m.name} (you)` : m.name}</span>
                {m.role === "leader" && <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-gold-ink">★ Leader</span>}
              </span>
              {isLeader && m.user_id !== circle.owner_id && (
                <form action={removeMember.bind(null, id)}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <Button type="submit" variant="ghost">Remove<span className="sr-only"> {m.name}</span></Button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {!isLeader && (
          <form action={leaveCircle.bind(null, id)} className="border-t border-line pt-3">
            <p className="mb-2 text-sm text-muted">Leaving stops sharing your goals with this circle.</p>
            <SubmitButton variant="secondary" pendingText="Leaving…">Leave circle</SubmitButton>
          </form>
        )}
      </Card>

      {isLeader && (
        <Card id="danger" aria-labelledby="danger-h" className="scroll-mt-4 space-y-3">
          <h2 id="danger-h" className="font-display text-xl font-bold">Delete circle</h2>
          <form action={deleteCircle.bind(null, id)} className="space-y-3">
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="confirm" value="yes" required className="size-5" />
              <span>Yes, delete this circle, its feed and meetups. Everyone&apos;s goals stay theirs and go back to private for this circle.</span>
            </label>
            <SubmitButton variant="danger" pendingText="Deleting…">Delete circle</SubmitButton>
          </form>
        </Card>
      )}
    </div>
  );
}

function LayerCard({
  layer,
  circleId,
  reactionAction,
  dareAction,
}: {
  layer: Layer;
  circleId: string;
  reactionAction: (fd: FormData) => Promise<void>;
  dareAction: (fd: FormData) => Promise<void>;
}) {
  const days = layer.view ? daysSinceLastCheckIn(layer.view.recent) : null;
  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{layer.mine ? "Your layer" : layer.ownerName}</p>
        {layer.quiet && (
          <span className="rounded-full bg-coral/15 px-2.5 py-0.5 text-xs font-semibold text-coral-ink">
            <span aria-hidden>…</span> Quiet for {days} days
          </span>
        )}
      </div>
      {layer.view ? (
        <div className="mt-2">
          {!layer.mine && <p className="mb-1 text-sm text-muted">{layer.view.title}</p>}
          <SharedViewBody view={layer.view} compact />
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted"><span aria-hidden>🔒</span> Private layer</p>
      )}
      {layer.mine ? (
        <ButtonLink href={`/app/goals/${layer.goalId}/share`} variant="secondary" className="mt-3">Choose what the circle sees</ButtonLink>
      ) : (
        <div className="mt-3 space-y-3">
          {layer.quiet && (
            <ButtonLink href={`/app/circles/${circleId}?nudge=${layer.ownerId}#encourage`} variant="sage">Send {layer.ownerName} a nudge</ButtonLink>
          )}
          <ReactionRow action={reactionAction} toId={layer.ownerId} toName={layer.ownerName} />
          {layer.view && (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Propose a dare for {layer.ownerName}</summary>
              <form action={dareAction} className="mt-2 space-y-3">
                <input type="hidden" name="goal_id" value={layer.goalId} />
                <Field label="The dare" id={`dare-${layer.goalId}`} hint="Keep it kind, safe and free. They decide whether to accept it.">
                  <Textarea id={`dare-${layer.goalId}`} name="description" required maxLength={200} placeholder="Miss two runs this week and you lead Sunday's warm-up." />
                </Field>
                <Field label="When it kicks in (optional)" id={`dare-rule-${layer.goalId}`}>
                  <Input id={`dare-rule-${layer.goalId}`} name="trigger_rule" maxLength={200} placeholder="Two missed check-ins in a week" />
                </Field>
                <SubmitButton variant="secondary" pendingText="Sending…">Propose dare</SubmitButton>
              </form>
            </details>
          )}
        </div>
      )}
    </li>
  );
}
