// One-tap check-in links for reminder emails and calendar events.
// token = HMAC-SHA256(`${goalId}:${day}:${userId}`, CHECKIN_LINK_SECRET), hex.
// The link carries no user id; the route looks up the goal owner and verifies.

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export type CheckinLinkStatus = "done" | "partly" | "missed";

function secret(): string {
  return process.env.CHECKIN_LINK_SECRET ?? "";
}

export function signCheckinLink(goalId: string, userId: string, day: string, key = secret()): string {
  if (!key) throw new Error("CHECKIN_LINK_SECRET is not set");
  return createHmac("sha256", key).update(`${goalId}:${day}:${userId}`).digest("hex");
}

export function verifyCheckinLink(goalId: string, userId: string, day: string, token: string, key = secret()): boolean {
  if (!key || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = Buffer.from(signCheckinLink(goalId, userId, day, key), "hex");
  const given = Buffer.from(token, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Alias kept short for callers that read better as `verify(...)`. */
export const verify = verifyCheckinLink;

/** Full URL for a reminder email or calendar event description. */
export function checkinUrl(goalId: string, userId: string, day: string, status: CheckinLinkStatus, base = env.appUrl): string {
  const q = new URLSearchParams({ g: goalId, d: day, s: status, t: signCheckinLink(goalId, userId, day) });
  return `${base.replace(/\/$/, "")}/api/checkin?${q.toString()}`;
}

/** Links are accepted for today, yesterday-ish, and up to two weeks back (late email opens). */
export function checkinDayAllowed(day: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day + "T00:00:00Z"))) return false;
  const diff = (Date.parse(today + "T00:00:00Z") - Date.parse(day + "T00:00:00Z")) / 86_400_000;
  return diff >= -1 && diff <= 14;
}
