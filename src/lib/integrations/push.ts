import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";

export interface PushPayload {
  title: string;
  body: string;
  /** Page to open on "Open" or a plain tap. */
  url?: string;
  /** One-tap check-in URL used by the "Done" action. */
  checkinUrl?: string;
  tag?: string;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured = false;

export function pushConfigured(): boolean {
  const { vapidPrivateKey, vapidSubject } = serverEnv();
  if (!env.vapidPublicKey || !vapidPrivateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(vapidSubject, env.vapidPublicKey, vapidPrivateKey);
    configured = true;
  }
  return true;
}

/** Gone endpoints (404/410) are pruned; other failures are reported. */
export async function sendPushToUser(db: SupabaseClient, userId: string, payload: PushPayload) {
  if (!pushConfigured()) return { sent: 0, pruned: 0, skipped: true as const };
  const { data } = await db.from("gk_push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", userId);
  const subs = (data ?? []) as PushSubscriptionRow[];
  let sent = 0;
  const gone: string[] = [];
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 6, urgency: "normal" });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
        else console.warn(`[push] send failed (${status ?? "network"})`);
      }
    }),
  );
  if (gone.length) await db.from("gk_push_subscriptions").delete().in("id", gone);
  return { sent, pruned: gone.length, skipped: false as const };
}
