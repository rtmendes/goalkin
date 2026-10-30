import "server-only";
// Google Calendar sync over plain REST (no googleapis package).
// Scope is only calendar.app.created: GoalKin creates its own "Goals" calendar
// and writes nowhere else. Push channels (watch) are renewed by the hourly cron,
// which also re-syncs because Google says notifications are not 100% reliable.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, serverEnv } from "@/lib/env";
import { effectivePlan, limits } from "@/lib/entitlements";
import type { Goal, PlanItem, Profile } from "@/lib/types";
import { checkinUrl } from "@/lib/integrations/links";
import { itemDay, inWindow, syncWindow } from "@/lib/integrations/calendar-items";
import { eventDiffers, eventToItemUpdate, googleEditedSince, itemToEvent, type GEvent } from "@/lib/integrations/gcal-map";
import { localDay, safeZone } from "@/lib/integrations/time";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3";
export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.app.created"];
export const STATE_COOKIE = "gk_google_state";
const WATCH_TTL_SECONDS = 7 * 24 * 3600;

export interface CalendarLink {
  user_id: string;
  ics_token: string;
  google_calendar_id: string | null;
  google_refresh_token: string | null;
  google_access_token: string | null;
  google_token_expires: string | null;
  watch_channel_id: string | null;
  watch_resource_id: string | null;
  watch_expires: string | null;
  last_sync_at: string | null;
}

export class GoogleError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const googleConfigured = () => !!(serverEnv().googleClientId && serverEnv().googleClientSecret);
export const redirectUri = () => `${env.appUrl}/api/google/oauth/callback`;

const hmac = (data: string) => createHmac("sha256", serverEnv().googleClientSecret).update(data).digest("hex");
function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Cookie value binding the OAuth state nonce to the signed-in person. */
export const signState = (nonce: string, userId: string) => `${nonce}.${hmac(`state:${nonce}:${userId}`)}`;
export function verifyState(cookie: string | undefined, state: string | null, userId: string): boolean {
  if (!cookie || !state) return false;
  const [nonce] = cookie.split(".");
  return nonce === state && safeEqual(cookie, signState(nonce, userId));
}

export const channelToken = (channelId: string, userId: string) => hmac(`watch:${channelId}:${userId}`);

export function authUrl(state: string): string {
  const qs = new URLSearchParams({
    client_id: serverEnv().googleClientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${qs.toString()}`;
}

interface TokenResponse { access_token: string; expires_in: number; refresh_token?: string; scope?: string }

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { googleClientId, googleClientSecret } = serverEnv();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: googleClientId, client_secret: googleClientSecret, ...params }),
  });
  if (!res.ok) throw new GoogleError(res.status, `token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as TokenResponse;
}

export const exchangeCode = (code: string) => tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });

export async function revokeToken(token: string) {
  await fetch(REVOKE_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) }).catch(() => null);
}

async function gfetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw new GoogleError(res.status, `google ${init.method ?? "GET"} ${path.split("?")[0]} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

export async function loadLink(db: SupabaseClient, userId: string): Promise<CalendarLink | null> {
  const { data } = await db.from("gk_calendar_links").select("*").eq("user_id", userId).maybeSingle();
  return (data as CalendarLink | null) ?? null;
}

/** A valid access token, refreshed and stored when within a minute of expiry. */
export async function accessTokenFor(db: SupabaseClient, link: CalendarLink): Promise<string> {
  const exp = link.google_token_expires ? Date.parse(link.google_token_expires) : 0;
  if (link.google_access_token && exp > Date.now() + 60_000) return link.google_access_token;
  if (!link.google_refresh_token) throw new GoogleError(401, "not connected");
  const t = await tokenRequest({ refresh_token: link.google_refresh_token, grant_type: "refresh_token" });
  const expires = new Date(Date.now() + t.expires_in * 1000).toISOString();
  await db.from("gk_calendar_links").update({ google_access_token: t.access_token, google_token_expires: expires }).eq("user_id", link.user_id);
  link.google_access_token = t.access_token;
  link.google_token_expires = expires;
  return t.access_token;
}

/** The app-created "Goals" calendar; recreated if the person deleted it in Google. */
export async function ensureGoalsCalendar(db: SupabaseClient, link: CalendarLink, token: string, tz: string): Promise<string> {
  if (link.google_calendar_id) {
    try {
      await gfetch(token, `/calendars/${encodeURIComponent(link.google_calendar_id)}`);
      return link.google_calendar_id;
    } catch (e) {
      if (!(e instanceof GoogleError) || (e.status !== 404 && e.status !== 410)) throw e;
    }
  }
  const cal = await gfetch<{ id: string }>(token, "/calendars", {
    method: "POST",
    body: JSON.stringify({ summary: "Goals", description: "Your GoalKin plan. Edit times here and GoalKin follows.", timeZone: tz }),
  });
  await db.from("gk_calendar_links").update({ google_calendar_id: cal.id, watch_channel_id: null, watch_resource_id: null, watch_expires: null }).eq("user_id", link.user_id);
  const ids = await ownGoalIds(db, link.user_id, false);
  if (ids.length) await db.from("gk_plan_items").update({ gcal_event_id: null }).in("goal_id", ids);
  link.google_calendar_id = cal.id;
  return cal.id;
}

async function ownGoalIds(db: SupabaseClient, userId: string, activeOnly: boolean): Promise<string[]> {
  let q = db.from("gk_goals").select("id").eq("owner_id", userId);
  if (activeOnly) q = q.eq("status", "active");
  const { data } = await q;
  return (data ?? []).map((g) => g.id as string);
}

export async function stopWatch(token: string, link: Pick<CalendarLink, "watch_channel_id" | "watch_resource_id">) {
  if (!link.watch_channel_id || !link.watch_resource_id) return;
  await gfetch(token, "/channels/stop", { method: "POST", body: JSON.stringify({ id: link.watch_channel_id, resourceId: link.watch_resource_id }) }).catch(() => null);
}

/** Register (or replace) the push channel on the Goals calendar's events. Needs a public https URL. */
export async function startWatch(db: SupabaseClient, link: CalendarLink, token: string): Promise<boolean> {
  if (!link.google_calendar_id || !env.appUrl.startsWith("https://")) return false;
  await stopWatch(token, link);
  const id = randomUUID();
  const res = await gfetch<{ id: string; resourceId: string; expiration?: string }>(
    token,
    `/calendars/${encodeURIComponent(link.google_calendar_id)}/events/watch`,
    {
      method: "POST",
      body: JSON.stringify({ id, type: "web_hook", address: `${env.appUrl}/api/google/notify`, token: channelToken(id, link.user_id), params: { ttl: String(WATCH_TTL_SECONDS) } }),
    },
  );
  const expires = new Date(res.expiration ? Number(res.expiration) : Date.now() + WATCH_TTL_SECONDS * 1000).toISOString();
  await db.from("gk_calendar_links").update({ watch_channel_id: res.id, watch_resource_id: res.resourceId, watch_expires: expires }).eq("user_id", link.user_id);
  Object.assign(link, { watch_channel_id: res.id, watch_resource_id: res.resourceId, watch_expires: expires });
  return true;
}

/** OAuth callback: store tokens, create the Goals calendar, start watching. */
export async function connectGoogle(userId: string, code: string) {
  const db = createAdminClient();
  const t = await exchangeCode(code);
  const existing = await loadLink(db, userId);
  const refresh = t.refresh_token ?? existing?.google_refresh_token ?? null;
  if (!refresh) throw new GoogleError(400, "Google did not return a refresh token");
  const { error } = await db.from("gk_calendar_links").upsert(
    { user_id: userId, google_refresh_token: refresh, google_access_token: t.access_token, google_token_expires: new Date(Date.now() + t.expires_in * 1000).toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  const link = (await loadLink(db, userId))!;
  const { data: profile } = await db.from("gk_profiles").select("timezone").eq("id", userId).maybeSingle();
  await ensureGoalsCalendar(db, link, t.access_token, safeZone(profile?.timezone as string | undefined));
  await startWatch(db, link, t.access_token).catch((e) => console.warn("[gcal] watch failed", (e as Error).message));
}

/** Removes the app-made Goals calendar, stops the channel, revokes access and clears stored ids. */
export async function disconnectGoogle(userId: string) {
  const db = createAdminClient();
  const link = await loadLink(db, userId);
  if (!link) return;
  if (link.google_refresh_token) {
    try {
      const token = await accessTokenFor(db, link);
      await stopWatch(token, link);
      if (link.google_calendar_id) await gfetch(token, `/calendars/${encodeURIComponent(link.google_calendar_id)}`, { method: "DELETE" }).catch(() => null);
      await revokeToken(link.google_refresh_token);
    } catch (e) {
      console.warn("[gcal] disconnect cleanup failed", (e as Error).message);
    }
  }
  await db.from("gk_calendar_links").update({
    google_calendar_id: null, google_refresh_token: null, google_access_token: null, google_token_expires: null,
    watch_channel_id: null, watch_resource_id: null, watch_expires: null, last_sync_at: null,
  }).eq("user_id", userId);
  const ids = await ownGoalIds(db, userId, false);
  if (ids.length) await db.from("gk_plan_items").update({ gcal_event_id: null }).in("goal_id", ids);
}

async function listEvents(token: string, calendarId: string): Promise<GEvent[]> {
  const out: GEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ maxResults: "2500", showDeleted: "true" });
    if (pageToken) qs.set("pageToken", pageToken);
    const res = await gfetch<{ items?: GEvent[]; nextPageToken?: string }>(token, `/calendars/${encodeURIComponent(calendarId)}/events?${qs}`);
    out.push(...(res.items ?? []));
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

export type SyncResult =
  | { ok: true; created: number; updated: number; deleted: number; pulled: number }
  | { ok: false; reason: "not_connected" | "plan" | "not_configured" | "error"; message?: string };

/**
 * Upsert the person's plan items (last 14 days, next 120) into the Goals calendar,
 * pull back times the person moved in Google, and remove events for items that
 * no longer exist. Events the person deleted in Google stay deleted.
 */
export async function syncUser(userId: string, now = new Date()): Promise<SyncResult> {
  if (!googleConfigured()) return { ok: false, reason: "not_configured" };
  const db = createAdminClient();
  const link = await loadLink(db, userId);
  if (!link?.google_refresh_token) return { ok: false, reason: "not_connected" };
  const { data: profileRow } = await db.from("gk_profiles").select("*").eq("id", userId).maybeSingle();
  const profile = profileRow as Profile | null;
  if (!profile || !limits(effectivePlan(profile, now)).googleSync) return { ok: false, reason: "plan" };
  const tz = safeZone(profile.timezone);
  const counts = { created: 0, updated: 0, deleted: 0, pulled: 0 };
  try {
    const token = await accessTokenFor(db, link);
    const calendarId = await ensureGoalsCalendar(db, link, token, tz);
    const calPath = `/calendars/${encodeURIComponent(calendarId)}/events`;

    const { data: goalRows } = await db.from("gk_goals").select("id,title,start_date,finish_date,status").eq("owner_id", userId).eq("status", "active");
    const goals = new Map(((goalRows ?? []) as Goal[]).map((g) => [g.id, g]));
    const { data: itemRows } = goals.size
      ? await db.from("gk_plan_items").select("*").in("goal_id", [...goals.keys()]).limit(5000)
      : { data: [] };
    const items = (itemRows ?? []) as PlanItem[];
    const allIds = new Set(items.map((i) => i.id));
    const window = syncWindow(localDay(now, tz));

    const events = await listEvents(token, calendarId);
    const byItem = new Map<string, GEvent>();
    for (const ev of events) {
      const id = ev.extendedProperties?.private?.gkItemId;
      if (id) byItem.set(id, ev);
    }

    const inRange = items.filter((i) => inWindow(itemDay(i, tz), window));
    await pool(inRange, 4, async (original) => {
      let item = original;
      const goal = goals.get(item.goal_id)!;
      const linkFor = (it: PlanItem) => checkinUrl(goal.id, userId, itemDay(it, tz) ?? localDay(now, tz));
      const ev = byItem.get(item.id);
      if (ev?.status === "cancelled") return;
      if (ev && googleEditedSince(ev, link.last_sync_at)) {
        const upd = eventToItemUpdate(ev, item, tz);
        if (upd) {
          await db.from("gk_plan_items").update(upd).eq("id", item.id);
          item = { ...item, ...upd };
          counts.pulled++;
        }
      }
      const desired = itemToEvent(item, goal, { tz, checkinLink: linkFor(item), appUrl: env.appUrl });
      if (!desired) return;
      if (ev?.id) {
        if (eventDiffers(desired, ev)) {
          await gfetch(token, `${calPath}/${encodeURIComponent(ev.id)}`, { method: "PATCH", body: JSON.stringify(desired) });
          counts.updated++;
        }
        if (item.gcal_event_id !== ev.id) await db.from("gk_plan_items").update({ gcal_event_id: ev.id }).eq("id", item.id);
      } else {
        const created = await gfetch<GEvent>(token, calPath, { method: "POST", body: JSON.stringify(desired) });
        await db.from("gk_plan_items").update({ gcal_event_id: created.id }).eq("id", item.id);
        counts.created++;
      }
    });

    const orphans = events.filter((ev) => ev.id && ev.status !== "cancelled" && !allIds.has(ev.extendedProperties?.private?.gkItemId ?? ""));
    await pool(orphans, 4, async (ev) => {
      await gfetch(token, `${calPath}/${encodeURIComponent(ev.id!)}`, { method: "DELETE" }).catch((e) => {
        if (!(e instanceof GoogleError) || (e.status !== 404 && e.status !== 410)) throw e;
      });
      counts.deleted++;
    });

    // Stamp after our own writes so their `updated` times never look like Google-side edits.
    await db.from("gk_calendar_links").update({ last_sync_at: new Date().toISOString() }).eq("user_id", userId);
    return { ok: true, ...counts };
  } catch (e) {
    const err = e as Error;
    // A revoked grant means the person disconnected from Google's side.
    if (err instanceof GoogleError && err.status === 400 && /invalid_grant/.test(err.message)) {
      await db.from("gk_calendar_links").update({ google_refresh_token: null, google_access_token: null, google_token_expires: null }).eq("user_id", userId);
    }
    console.warn("[gcal] sync failed", err.message);
    return { ok: false, reason: "error", message: err.message };
  }
}

/** Validates a Google push notification and returns the person to re-sync, if any. */
export async function userForNotification(h: Headers): Promise<string | null> {
  const channelId = h.get("x-goog-channel-id");
  const token = h.get("x-goog-channel-token");
  if (!channelId || !token || !googleConfigured()) return null;
  const db = createAdminClient();
  const { data } = await db.from("gk_calendar_links").select("user_id").eq("watch_channel_id", channelId).maybeSingle();
  if (!data) return null;
  const userId = data.user_id as string;
  return safeEqual(token, channelToken(channelId, userId)) ? userId : null;
}

/** Hourly: renew channels expiring within 24h, and re-sync anyone not synced for 3 hours. */
export async function maintainCalendars(now = new Date(), budgetMs = 50_000) {
  const started = Date.now();
  const db = createAdminClient();
  const { data } = await db.from("gk_calendar_links").select("*").not("google_refresh_token", "is", null).limit(500);
  const links = (data ?? []) as CalendarLink[];
  const soon = now.getTime() + 24 * 3600_000;
  const stale = now.getTime() - 3 * 3600_000;
  const result = { renewed: 0, synced: 0, failed: 0, skipped: 0 };
  for (const link of links) {
    if (Date.now() - started > budgetMs) {
      result.skipped++;
      continue;
    }
    try {
      if (!link.watch_expires || Date.parse(link.watch_expires) < soon) {
        const token = await accessTokenFor(db, link);
        if (await startWatch(db, link, token)) result.renewed++;
      }
      if (!link.last_sync_at || Date.parse(link.last_sync_at) < stale) {
        const r = await syncUser(link.user_id, now);
        if (r.ok) result.synced++;
        else if (r.reason === "error") result.failed++;
      }
    } catch (e) {
      result.failed++;
      console.warn("[gcal] maintain failed", (e as Error).message);
    }
  }
  return result;
}
