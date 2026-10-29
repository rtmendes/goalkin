import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|api/ics|api/cron|api/webhooks|api/google/notify|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
