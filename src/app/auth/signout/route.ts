import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    /* already signed out or auth not configured; still go home */
  }
  // 303 so the browser follows with GET after the form POST.
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
