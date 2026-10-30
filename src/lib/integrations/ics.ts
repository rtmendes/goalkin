// RFC 5545 calendar feed builder. Pure: no I/O, so it is fully unit-tested.
// Lines end in CRLF, are folded at 75 octets (UTF-8 safe), and TEXT values
// escape backslash, semicolon, comma and newlines. Timed events are written as
// UTC ("Z") so no VTIMEZONE block is needed; date-only items are all-day events.

export type IcsStart = { date: string } | { dateTime: Date };

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  url?: string;
  start: IcsStart;
  durationMin?: number | null;
  /** Weekly repeat until this date (inclusive), for check-in series. */
  weeklyUntil?: string | null;
  categories?: string[];
}

const CRLF = "\r\n";
const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Fold a content line so no physical line exceeds 75 octets; never splits a UTF-8 character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      out.push(cur);
      cur = " " + ch;
      bytes = 1 + b;
      limit = 75;
    } else {
      cur += ch;
      bytes += b;
    }
  }
  out.push(cur);
  return out.join(CRLF);
}

export function formatUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function formatDate(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Bad date: ${day}`);
  return day.replace(/-/g, "");
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function eventLines(e: IcsEvent, stamp: string): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`];
  if ("date" in e.start) {
    lines.push(`DTSTART;VALUE=DATE:${formatDate(e.start.date)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDate(addDays(e.start.date, 1))}`);
  } else {
    const end = new Date(e.start.dateTime.getTime() + (e.durationMin && e.durationMin > 0 ? e.durationMin : 30) * 60_000);
    lines.push(`DTSTART:${formatUtc(e.start.dateTime)}`);
    lines.push(`DTEND:${formatUtc(end)}`);
  }
  if (e.weeklyUntil) {
    // For DATE starts, UNTIL must be a DATE too (RFC 5545 §3.3.10).
    const until = "date" in e.start ? formatDate(e.weeklyUntil) : formatUtc(new Date(e.weeklyUntil + "T23:59:59Z"));
    lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${until}`);
  }
  lines.push(`SUMMARY:${escapeText(e.summary)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  if (e.categories?.length) lines.push(`CATEGORIES:${e.categories.map(escapeText).join(",")}`);
  lines.push("TRANSP:TRANSPARENT", "END:VEVENT");
  return lines;
}

export function buildCalendar(input: { name: string; events: IcsEvent[]; now?: Date }): string {
  const stamp = formatUtc(input.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GoalKin//Goals feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...input.events.flatMap((e) => eventLines(e, stamp)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
