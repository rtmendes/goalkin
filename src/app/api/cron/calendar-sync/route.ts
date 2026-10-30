// Hourly (vercel.json): renew Google watch channels expiring within 24h and
// re-sync stale calendars, since Google push notifications are not 100% reliable.
import { cronAuthorized } from "@/lib/integrations/cron";
import { googleConfigured, maintainCalendars } from "@/lib/integrations/gcal";

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!googleConfigured()) return Response.json({ ok: true, skipped: "google_not_configured" });
  const stats = await maintainCalendars(new Date());
  return Response.json({ ok: true, ...stats });
}
