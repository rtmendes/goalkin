import "server-only";
import { getUser } from "@/lib/auth";

/** The signed-in person on public pages, or null. Never throws (e.g. Supabase not configured yet). */
export async function optionalUser() {
  try {
    const { supabase, user } = await getUser();
    return user ? { supabase, user } : null;
  } catch {
    return null;
  }
}
