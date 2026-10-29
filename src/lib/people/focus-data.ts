import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { focusPhase } from "@/lib/people/focus";
import { namesFor } from "@/lib/people/server";

export interface RoomParticipant {
  user_id: string;
  name: string;
  intention: string | null;
  done_note: string | null;
  is_host: boolean;
}

export interface RoomState {
  id: string;
  name: string;
  host_id: string;
  circle_id: string | null;
  status: "waiting" | "running" | "done";
  started_at: string | null;
  work_min: number;
  break_min: number;
  rounds: number;
  invite_code: string;
  participants: RoomParticipant[];
  joined: boolean;
  server_time: number;
}

/**
 * Room as the signed-in viewer may see it. Reads through RLS (host, participants
 * and members of the room's circle); returns null for anyone else.
 */
export async function loadRoomState(supabase: SupabaseClient, roomId: string, viewerId: string): Promise<RoomState | null> {
  const { data: room } = await supabase
    .from("gk_focus_rooms")
    .select("id, name, host_id, circle_id, status, started_at, work_min, break_min, rounds, invite_code")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) return null;
  const { data: people } = await supabase
    .from("gk_focus_participants")
    .select("user_id, intention, done_note, joined_at")
    .eq("room_id", roomId)
    .order("joined_at");
  const rows = (people ?? []) as { user_id: string; intention: string | null; done_note: string | null }[];
  const names = await namesFor(rows.map((r) => r.user_id));

  let status = room.status as RoomState["status"];
  const now = Date.now();
  if (status === "running" && focusPhase({ startedAt: room.started_at, now, workMin: room.work_min, breakMin: room.break_min, rounds: room.rounds }).phase === "done") {
    // Close out finished sessions lazily, so no cron is needed.
    try {
      await createAdminClient().from("gk_focus_rooms").update({ status: "done" }).eq("id", roomId).eq("status", "running");
    } catch {
      /* status is derived from the clock anyway */
    }
    status = "done";
  }

  return {
    id: room.id,
    name: room.name,
    host_id: room.host_id,
    circle_id: room.circle_id,
    status,
    started_at: room.started_at,
    work_min: room.work_min,
    break_min: room.break_min,
    rounds: room.rounds,
    invite_code: room.invite_code,
    participants: rows.map((r) => ({
      user_id: r.user_id,
      name: names.get(r.user_id) ?? "A GoalKin member",
      intention: r.intention,
      done_note: r.done_note,
      is_host: r.user_id === room.host_id,
    })),
    joined: rows.some((r) => r.user_id === viewerId),
    server_time: now,
  };
}
