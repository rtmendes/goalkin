"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Field, Input, Notice, Textarea } from "@/components/ui";
import { CopyButton } from "@/components/people/copy-button";
import { SubmitButton } from "@/components/people/submit-button";
import { clockOffset, focusPhase, formatClock, phaseLabel, spokenClock } from "@/lib/people/focus";
import type { RoomState } from "@/lib/people/focus-data";

const POLL_MS = 5000;

type Action = () => Promise<void>;
type FormAction = (fd: FormData) => Promise<void>;

export function FocusRoom({
  initial,
  meId,
  inviteUrl,
  actions,
}: {
  initial: RoomState;
  meId: string;
  inviteUrl: string;
  actions: { start: Action; join: Action; leave: Action; intention: FormAction; doneNote: FormAction };
}) {
  const [room, setRoom] = useState<RoomState>(initial);
  const [offset, setOffset] = useState(0);
  // First render uses the server's clock so server and client markup match.
  const [now, setNow] = useState(initial.server_time);
  const [offline, setOffline] = useState(false);
  const inFlight = useRef(false);

  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const sent = Date.now();
    try {
      const res = await fetch(`/api/focus/${initial.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as RoomState;
      setOffset(clockOffset(next.server_time, sent, Date.now()));
      setRoom(next);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      inFlight.current = false;
    }
  }, [initial.id]);

  useEffect(() => {
    const first = setTimeout(poll, 0);
    const p = setInterval(poll, POLL_MS);
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearTimeout(first);
      clearInterval(p);
      clearInterval(t);
    };
  }, [poll]);

  const state = room.status === "waiting"
    ? focusPhase({ startedAt: null, now, workMin: room.work_min, breakMin: room.break_min, rounds: room.rounds })
    : focusPhase({ startedAt: room.started_at, now: now + offset, workMin: room.work_min, breakMin: room.break_min, rounds: room.rounds });
  const isHost = room.host_id === meId;
  const me = room.participants.find((p) => p.user_id === meId);
  const label = phaseLabel(state);
  const progress = state.phaseMs ? Math.round(((state.phaseMs - state.remainingMs) / state.phaseMs) * 100) : state.phase === "done" ? 100 : 0;

  // Re-fetch right after our own actions so the page reflects them without waiting for the next poll.
  const after = (fn: Action) => async () => { await fn(); await poll(); };
  const afterForm = (fn: FormAction) => async (fd: FormData) => { await fn(fd); await poll(); };

  return (
    <div className="space-y-5">
      <Card className="text-center">
        {/* Announced only when the phase changes, never every second. */}
        <p aria-live="polite" aria-atomic="true" className="font-fun text-xl font-bold">
          <span aria-hidden className="mr-1">{state.phase === "focus" ? "◉" : state.phase === "break" ? "☕" : state.phase === "done" ? "★" : "○"}</span>
          {label}
        </p>
        <div role="timer" aria-label={state.phase === "waiting" || state.phase === "done" ? label : spokenClock(state.remainingMs)} className="my-4">
          <span aria-hidden className="font-display text-7xl font-bold tabular-nums sm:text-8xl">
            {state.phase === "waiting" ? formatClock(room.work_min * 60_000) : formatClock(state.remainingMs)}
          </span>
        </div>
        {(state.phase === "focus" || state.phase === "break") && (
          <div role="progressbar" aria-label={`${state.phase === "focus" ? "Focus" : "Break"} progress`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="mx-auto h-2.5 max-w-md overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${state.phase === "focus" ? "bg-sage" : "bg-gold"}`} style={{ width: `${progress}%` }} />
          </div>
        )}
        <p className="mt-3 text-sm text-muted">
          {room.rounds} round{room.rounds === 1 ? "" : "s"} of {room.work_min} min focus{room.rounds > 1 ? `, ${room.break_min} min breaks` : ""}
        </p>
        {offline && <p className="mt-2 text-sm text-coral-ink">Reconnecting… the timer keeps running.</p>}

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {room.status === "waiting" && isHost && (
            <form action={after(actions.start)}>
              <SubmitButton variant="sage" pendingText="Starting…">Start the session</SubmitButton>
            </form>
          )}
          {!room.joined && state.phase !== "done" && (
            <form action={after(actions.join)}>
              <SubmitButton pendingText="Joining…">Join this room</SubmitButton>
            </form>
          )}
        </div>
        {room.status === "waiting" && !isHost && <p className="mt-2 text-sm text-muted">The host starts the timer for everyone.</p>}
      </Card>

      {room.joined && state.phase !== "done" && (
        <Card>
          <form action={afterForm(actions.intention)} className="space-y-3">
            <Field label="My intention for this session" id="intention" hint="One line the room can see.">
              <Input id="intention" name="intention" maxLength={140} defaultValue={me?.intention ?? ""} placeholder="Finish the draft of chapter 2" />
            </Field>
            <SubmitButton variant="secondary" pendingText="Saving…">Save intention</SubmitButton>
          </form>
        </Card>
      )}

      {room.joined && state.phase === "done" && (
        <Card>
          <form action={afterForm(actions.doneNote)} className="space-y-3">
            <Field label="Check in: how did it go?" id="done-note" hint="Shared with the people in this room.">
              <Textarea id="done-note" name="done_note" maxLength={500} defaultValue={me?.done_note ?? ""} placeholder="Got through two sections. Next: edit." />
            </Field>
            <SubmitButton pendingText="Saving…">Save check-in</SubmitButton>
          </form>
        </Card>
      )}

      <Card aria-labelledby="people-h">
        <h2 id="people-h" className="mb-3 font-display text-xl font-bold">In the room ({room.participants.length})</h2>
        {room.participants.length === 0 ? (
          <p className="text-muted">Nobody yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {room.participants.map((p) => (
              <li key={p.user_id} className="py-2">
                <p className="font-semibold">
                  {p.user_id === meId ? `${p.name} (you)` : p.name}
                  {p.is_host && <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-gold-ink">★ Host</span>}
                </p>
                {p.intention && <p className="text-sm"><span className="text-muted">Intention:</span> {p.intention}</p>}
                {p.done_note && <p className="text-sm"><span className="text-muted">Check-in:</span> {p.done_note}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="invite-h" className="space-y-3">
        <h2 id="invite-h" className="font-display text-xl font-bold">Invite someone</h2>
        <Notice>People who join see your name, your intention and your check-in note in this room. Nothing from your goals is shared.</Notice>
        <p className="break-all rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm">{inviteUrl}</p>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={inviteUrl} />
          {room.joined && (
            <form action={actions.leave}>
              <SubmitButton variant="ghost" pendingText="Leaving…">Leave room</SubmitButton>
            </form>
          )}
        </div>
        <p className="text-sm text-muted">Room code: <span className="font-mono">{room.invite_code}</span></p>
      </Card>
    </div>
  );
}
