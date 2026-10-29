import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Card, Empty, Field, Input, Notice, PageHeader, Select } from "@/components/ui";
import { Flash } from "@/components/people/flash";
import { SubmitButton } from "@/components/people/submit-button";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRoomCode } from "@/lib/people/invites";
import { namesFor, planLimits } from "@/lib/people/server";
import { createRoom, joinRoomByCode } from "./actions";

export const metadata: Metadata = { title: "Focus rooms" };

interface RoomRow { id: string; name: string; status: "waiting" | "running" | "done"; work_min: number; break_min: number; rounds: number; host_id: string; created_at: string }

const STATUS: Record<RoomRow["status"], string> = { waiting: "○ Waiting to start", running: "◉ In session", done: "★ Finished" };

export default async function FocusPage({ searchParams }: { searchParams: Promise<{ n?: string; join?: string }> }) {
  const { n, join } = await searchParams;
  const { supabase, user, profile } = await requireUser("/app/focus");
  const canHost = planLimits(profile).focusRooms;
  const joinCode = join && isRoomCode(join.toLowerCase()) ? join.toLowerCase() : "";

  const [{ data: roomData }, { data: memberships }] = await Promise.all([
    // RLS shows rooms I host, joined, or that belong to one of my circles.
    supabase.from("gk_focus_rooms").select("id, name, status, work_min, break_min, rounds, host_id, created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("gk_circle_members").select("circle_id").eq("user_id", user.id),
  ]);
  const rooms = (roomData ?? []) as RoomRow[];
  const circleIds = (memberships ?? []).map((m) => m.circle_id as string);
  const { data: circleData } = circleIds.length ? await supabase.from("gk_circles").select("id, name").in("id", circleIds) : { data: [] };
  const circles = (circleData ?? []) as { id: string; name: string }[];

  // Someone followed an invite link: show which room before they join (the code alone grants the lookup).
  let invited: { name: string; host: string } | null = null;
  if (joinCode) {
    const { data } = await createAdminClient().from("gk_focus_rooms").select("name, host_id").eq("invite_code", joinCode).maybeSingle();
    if (data) invited = { name: data.name as string, host: (await namesFor([data.host_id as string])).get(data.host_id as string) ?? "Someone" };
  }
  const hosts = await namesFor(rooms.map((r) => r.host_id));
  const active = rooms.filter((r) => r.status !== "done");
  const past = rooms.filter((r) => r.status === "done").slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader title="Focus rooms" sub="Timed sessions with your people: focus together, break together, check in at the end." />
      <Flash code={n} />

      {joinCode && (
        <Card aria-labelledby="inv-h" className="space-y-3 border-sage">
          <h2 id="inv-h" className="font-display text-xl font-bold">{invited ? `Join “${invited.name}”?` : "Room not found"}</h2>
          {invited ? (
            <>
              <p className="text-muted">Hosted by {invited.host}. The room sees your name, your intention and your check-in note. Nothing from your goals.</p>
              <form action={joinRoomByCode}>
                <input type="hidden" name="code" value={joinCode} />
                <SubmitButton pendingText="Joining…">Join room</SubmitButton>
              </form>
            </>
          ) : (
            <p className="text-muted">That invite code didn&apos;t match a room. Ask the host for a fresh link.</p>
          )}
        </Card>
      )}

      <section aria-labelledby="rooms-h">
        <h2 id="rooms-h" className="mb-3 font-display text-xl font-bold">Your rooms</h2>
        {active.length === 0 ? (
          <Empty title="No open rooms">Start one below or join with a code.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {active.map((r) => (
              <li key={r.id}>
                <Link href={`/app/focus/${r.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
                  <span className="block font-semibold">{r.name}</span>
                  <span className="mt-1 block text-sm text-muted">{STATUS[r.status]} · {r.rounds} × {r.work_min}/{r.break_min} min · host {r.host_id === user.id ? "you" : hosts.get(r.host_id)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <details className="mt-3">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">Finished sessions ({past.length})</summary>
            <ul className="mt-1 space-y-1">
              {past.map((r) => (
                <li key={r.id}><Link className="underline" href={`/app/focus/${r.id}`}>{r.name}</Link> <span className="text-sm text-muted">· {r.created_at.slice(0, 10)}</span></li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <Card aria-labelledby="code-h">
        <h2 id="code-h" className="mb-3 font-display text-xl font-bold">Join with a code</h2>
        <form action={joinRoomByCode} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Field label="Room code" id="room-code" hint="12 letters and numbers, from the host's invite.">
              <Input id="room-code" name="code" required pattern="[a-fA-F0-9]{12}" defaultValue={joinCode} autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </Field>
          </div>
          <SubmitButton variant="secondary" pendingText="Joining…">Join</SubmitButton>
        </form>
      </Card>

      <Card aria-labelledby="new-h">
        <h2 id="new-h" className="mb-3 font-display text-xl font-bold">Host a room</h2>
        {!canHost ? (
          <div className="space-y-3">
            <Notice>Hosting focus rooms is part of Pro. Anyone you invite can join for free.</Notice>
            <ButtonLink href="/pricing">See plans</ButtonLink>
          </div>
        ) : (
          <form action={createRoom} className="space-y-4">
            <Field label="Room name" id="r-name">
              <Input id="r-name" name="name" required maxLength={80} placeholder="Morning deep work" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Focus (minutes)" id="r-work">
                <Input id="r-work" name="work_min" type="number" min={5} max={120} defaultValue={25} required />
              </Field>
              <Field label="Break (minutes)" id="r-break">
                <Input id="r-break" name="break_min" type="number" min={1} max={60} defaultValue={5} required />
              </Field>
              <Field label="Rounds" id="r-rounds">
                <Input id="r-rounds" name="rounds" type="number" min={1} max={12} defaultValue={4} required />
              </Field>
            </div>
            {circles.length > 0 && (
              <Field label="Open to a circle (optional)" id="r-circle" hint="Members of that circle can see and join the room.">
                <Select id="r-circle" name="circle_id" defaultValue="">
                  <option value="">Only people I invite</option>
                  {circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            )}
            <SubmitButton pendingText="Creating…">Create room</SubmitButton>
          </form>
        )}
      </Card>
    </div>
  );
}
