import { after, NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { connectGoogle, STATE_COOKIE, syncUser, verifyState } from "@/lib/integrations/gcal";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const back = (q: string) => {
    const res = NextResponse.redirect(`${env.appUrl}/app/settings?google=${q}#calendar`, 303);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/google/oauth" });
    return res;
  };
  const { user } = await getUser();
  if (!user) return NextResponse.redirect(`${env.appUrl}/login?next=${encodeURIComponent("/app/settings#calendar")}`, 303);

  const url = req.nextUrl;
  if (url.searchParams.get("error")) return back("denied");
  if (!verifyState(req.cookies.get(STATE_COOKIE)?.value, url.searchParams.get("state"), user.id)) return back("expired");
  const code = url.searchParams.get("code");
  if (!code) return back("error");

  try {
    await connectGoogle(user.id, code);
  } catch (e) {
    console.warn("[gcal] connect failed", (e as Error).message);
    return back("error");
  }
  after(() => syncUser(user.id));
  return back("connected");
}
