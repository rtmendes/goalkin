// Focus-room timer math. Everyone computes the phase from the same started_at and
// durations, so the room stays in sync without a socket.

export type FocusPhase = "waiting" | "focus" | "break" | "done";

export interface FocusState {
  phase: FocusPhase;
  /** 1-based round number (0 while waiting). */
  round: number;
  rounds: number;
  /** Milliseconds left in the current phase (0 when waiting or done). */
  remainingMs: number;
  /** Length of the current phase in milliseconds. */
  phaseMs: number;
  /** Total session length: N focus blocks with a break between each (no break after the last). */
  totalMs: number;
}

const MIN = 60_000;

export function focusTotalMs(workMin: number, breakMin: number, rounds: number): number {
  return rounds * workMin * MIN + Math.max(0, rounds - 1) * breakMin * MIN;
}

export function focusPhase(input: {
  startedAt: string | Date | null;
  now: number | Date;
  workMin: number;
  breakMin: number;
  rounds: number;
}): FocusState {
  const { workMin, breakMin, rounds } = input;
  const totalMs = focusTotalMs(workMin, breakMin, rounds);
  const base = { rounds, totalMs };
  if (!input.startedAt) return { ...base, phase: "waiting", round: 0, remainingMs: 0, phaseMs: 0 };

  const start = new Date(input.startedAt).getTime();
  const now = typeof input.now === "number" ? input.now : input.now.getTime();
  const elapsed = now - start;
  const work = workMin * MIN;
  const brk = breakMin * MIN;

  // A slightly fast clock can put "now" before the start; treat it as the first second of focus.
  if (elapsed < 0) return { ...base, phase: "focus", round: 1, remainingMs: work, phaseMs: work };
  if (elapsed >= totalMs) return { ...base, phase: "done", round: rounds, remainingMs: 0, phaseMs: 0 };

  const cycle = work + brk;
  const round = Math.floor(elapsed / cycle) + 1;
  const into = elapsed - (round - 1) * cycle;
  if (into < work) return { ...base, phase: "focus", round, remainingMs: work - into, phaseMs: work };
  return { ...base, phase: "break", round, remainingMs: cycle - into, phaseMs: brk };
}

/** "4:05", or "1:02:03" for an hour or more. Rounds up so the display never shows 0:00 early. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Plain words for screen readers, e.g. "4 minutes 5 seconds left". */
export function spokenClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const parts = [];
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (s || !m) parts.push(`${s} second${s === 1 ? "" : "s"}`);
  return `${parts.join(" ")} left`;
}

export function phaseLabel(state: Pick<FocusState, "phase" | "round" | "rounds">): string {
  switch (state.phase) {
    case "waiting": return "Waiting for the host to start";
    case "focus": return `Focus, round ${state.round} of ${state.rounds}`;
    case "break": return `Break, round ${state.round} of ${state.rounds}`;
    default: return "Done. Nice work.";
  }
}

/** Server-minus-client clock offset from one round trip (assumes symmetric latency). */
export function clockOffset(serverTimeMs: number, sentAtMs: number, receivedAtMs: number): number {
  return serverTimeMs - (sentAtMs + receivedAtMs) / 2;
}
