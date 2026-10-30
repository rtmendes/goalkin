// Time-zone helpers for meetups. A <input type="datetime-local"> value has no zone,
// so we read it in the person's profile time zone.

const safeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
};

/** Offset (ms) of `tz` from UTC at instant `t`. */
function zoneOffset(t: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(t / 1000) * 1000;
}

/** "2026-11-01T18:00" in `tz` → Date (UTC instant). Returns null for malformed input. */
export function localToUtc(local: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!m) return null;
  const zone = safeZone(tz);
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  if (Number.isNaN(naive)) return null;
  // Two passes settle the offset across DST changes.
  let t = naive - zoneOffset(naive, zone);
  t = naive - zoneOffset(t, zone);
  return new Date(t);
}

export function formatWhen(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(tz),
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** ISO timestamp `hours` before now (kept out of components so render stays pure). */
export function hoursAgoIso(hours: number, now = new Date()): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}
