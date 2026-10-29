// One-tap check-in links for email, push and calendar descriptions.
// Same scheme as src/lib/checkin-link.ts (signCheckinLink): token = HMAC-SHA256 hex
// of `${goalId}:${day}:${userId}` keyed with CHECKIN_LINK_SECRET. The status is not
// signed, so one token serves the done / partly / missed buttons for that day.
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export type LinkStatus = "done" | "partly" | "missed";

const secret = () => process.env.CHECKIN_LINK_SECRET ?? "";

export function checkinToken(goalId: string, day: string, userId: string, key = secret()): string {
  return createHmac("sha256", key).update(`${goalId}:${day}:${userId}`).digest("hex");
}

export function verifyCheckinToken(goalId: string, day: string, userId: string, token: string, key = secret()): boolean {
  if (!key || !/^[a-f0-9]{64}$/.test(token)) return false;
  const want = Buffer.from(checkinToken(goalId, day, userId, key), "hex");
  return timingSafeEqual(want, Buffer.from(token, "hex"));
}

/** Relative path, compatible with signCheckinLink(goalId, userId, day). */
export function checkinPath(goalId: string, userId: string, day: string, status: LinkStatus = "done", key = secret()): string {
  const qs = new URLSearchParams({ g: goalId, d: day, s: status, t: checkinToken(goalId, day, userId, key) });
  return `/api/checkin?${qs.toString()}`;
}

/**
 * Absolute one-tap URL. Without a signing secret the link would be forgeable,
 * so it falls back to the app's Today page instead.
 */
export function checkinUrl(goalId: string, userId: string, day: string, status: LinkStatus = "done", key = secret()): string {
  if (!key) return `${env.appUrl}/app`;
  return `${env.appUrl}${checkinPath(goalId, userId, day, status, key)}`;
}
