import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadRoomState } from "@/lib/people/focus-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Polled every few seconds by the room page: status, participants and server time (for clock skew). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = { "Cache-Control": "no-store" };
  if (!UUID.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "sign_in" }, { status: 401, headers });
  const state = await loadRoomState(supabase, id, data.user.id);
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  return NextResponse.json(state, { headers });
}
