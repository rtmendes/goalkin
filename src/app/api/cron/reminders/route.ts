// Every 15 minutes (vercel.json): reminders, Sunday recaps, partner-quiet nudges.
import { cronAuthorized } from "@/lib/integrations/cron";
import { runReminderJobs } from "@/lib/integrations/jobs";

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const stats = await runReminderJobs(new Date());
  return Response.json({ ok: true, ...stats });
}
