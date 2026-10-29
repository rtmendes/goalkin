// Google Calendar push channel receiver. Google only says "something changed";
// we validate the channel token, answer at once, then re-sync in the background.
import { after } from "next/server";
import { syncUser, userForNotification } from "@/lib/integrations/gcal";

export const maxDuration = 60;

export async function POST(req: Request) {
  const userId = await userForNotification(req.headers);
  // Unknown or forged channels get a plain 200 too, so probing learns nothing.
  if (!userId) return new Response(null, { status: 200 });
  if (req.headers.get("x-goog-resource-state") !== "sync") after(() => syncUser(userId));
  return new Response(null, { status: 200 });
}
