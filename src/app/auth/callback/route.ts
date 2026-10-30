import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { applyPendingPurchases } from "@/lib/commerce/purchases";
import { safeNext } from "@/lib/site/redirect";

// Magic links, email confirmations and Google sign-in land here.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}&error=${code}`, url.origin));

  if (url.searchParams.get("error")) return fail(url.searchParams.get("error_code")?.includes("otp") ? "link" : "callback");

  const supabase = await createClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let user: { id: string; email?: string | null } | null = null;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("link");
    user = data.user;
  } else if (tokenHash && type) {
    // Email templates that link with token_hash instead of a PKCE code.
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail("link");
    user = data.user;
  } else {
    return fail("callback");
  }

  if (user) await applyPendingPurchases(user.id, user.email);
  return NextResponse.redirect(new URL(next, url.origin));
}
