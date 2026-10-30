import "server-only";
// gk_calendar_links has no RLS policies (it holds Google tokens), so the
// signed-in person's own row is read here with the service role and only
// non-secret fields leave this module.
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export interface CalendarStatus {
  icsUrl: string | null;
  googleConnected: boolean;
  googleCalendarCreated: boolean;
  lastSyncAt: string | null;
  watchActive: boolean;
}

const newIcsToken = () => randomBytes(18).toString("hex"); // 36 hex chars, same as the column default

export async function getCalendarStatus(userId: string): Promise<CalendarStatus> {
  const empty: CalendarStatus = { icsUrl: null, googleConnected: false, googleCalendarCreated: false, lastSyncAt: null, watchActive: false };
  try {
    const db = createAdminClient();
    let { data } = await db.from("gk_calendar_links").select("ics_token,google_calendar_id,google_refresh_token,last_sync_at,watch_expires").eq("user_id", userId).maybeSingle();
    if (!data) {
      const ins = await db.from("gk_calendar_links").insert({ user_id: userId, ics_token: newIcsToken() }).select("ics_token,google_calendar_id,google_refresh_token,last_sync_at,watch_expires").maybeSingle();
      data = ins.data;
    }
    if (!data) return empty;
    return {
      icsUrl: `${env.appUrl}/api/ics/${data.ics_token}.ics`,
      googleConnected: !!data.google_refresh_token,
      googleCalendarCreated: !!data.google_calendar_id,
      lastSyncAt: (data.last_sync_at as string | null) ?? null,
      watchActive: !!data.watch_expires && Date.parse(data.watch_expires as string) > Date.now(),
    };
  } catch {
    return empty;
  }
}

/** New feed URL; the old one stops working immediately. */
export async function resetIcsToken(userId: string) {
  const db = createAdminClient();
  const token = newIcsToken();
  await db.from("gk_calendar_links").upsert({ user_id: userId, ics_token: token }, { onConflict: "user_id" });
}

export async function deleteCalendarLink(userId: string) {
  await createAdminClient().from("gk_calendar_links").delete().eq("user_id", userId);
}
