"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRoomCode } from "@/lib/people/invites";
import { planLimits, roleIn } from "@/lib/people/server";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : undefined;
};

const roomSchema = z.object({
  name: z.string().trim().min(1).max(80),
  work_min: z.coerce.number().int().min(5).max(120),
  break_min: z.coerce.number().int().min(1).max(60),
  rounds: z.coerce.number().int().min(1).max(12),
  circle_id: uuid.optional().or(z.literal("").transform(() => undefined)),
});

export async function createRoom(fd: FormData) {
  const { supabase, user, profile } = await requireUser("/app/focus");
  if (!planLimits(profile).focusRooms) redirect("/app/focus?n=need_focus_plan");
  const parsed = roomSchema.safeParse({
    name: str(fd, "name"),
    work_min: str(fd, "work_min") ?? 25,
    break_min: str(fd, "break_min") ?? 5,
    rounds: str(fd, "rounds") ?? 4,
    circle_id: str(fd, "circle_id") ?? "",
  });
  if (!parsed.success) redirect("/app/focus?n=invalid");
  const { circle_id, ...rest } = parsed.data;
  if (circle_id && !(await roleIn(circle_id, user.id))) redirect("/app/focus?n=not_member");
  const { data: room, error } = await supabase
    .from("gk_focus_rooms")
    .insert({ ...rest, circle_id: circle_id ?? null, host_id: user.id })
    .select("id")
    .single();
  if (error || !room) redirect("/app/focus?n=failed");
  await supabase.from("gk_focus_participants").insert({ room_id: room.id, user_id: user.id });
  revalidatePath("/app/focus");
  redirect(`/app/focus/${room.id}`);
}

async function addSelf(roomId: string, userId: string, supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const { error } = await supabase.from("gk_focus_participants").insert({ room_id: roomId, user_id: userId });
  return !error || error.code === "23505";
}

/** Join by invite code. Anyone with the code may join; the lookup needs the service role because RLS hides rooms you're not in yet. */
export async function joinRoomByCode(fd: FormData) {
  const code = (str(fd, "code") ?? "").trim().toLowerCase();
  const { supabase, user } = await requireUser(`/app/focus?join=${encodeURIComponent(code)}`);
  if (!isRoomCode(code)) redirect("/app/focus?n=bad_code");
  const { data: room } = await createAdminClient().from("gk_focus_rooms").select("id").eq("invite_code", code).maybeSingle();
  if (!room) redirect("/app/focus?n=bad_code");
  if (!(await addSelf(room.id as string, user.id, supabase))) redirect("/app/focus?n=failed");
  redirect(`/app/focus/${room.id}?n=room_joined`);
}

/** Join a room you can already see (for example, one in your circle). */
export async function joinRoom(roomId: string) {
  if (!uuid.safeParse(roomId).success) redirect("/app/focus");
  const { supabase, user } = await requireUser(`/app/focus/${roomId}`);
  const { data: room } = await supabase.from("gk_focus_rooms").select("id").eq("id", roomId).maybeSingle();
  if (!room) redirect("/app/focus?n=bad_code");
  await addSelf(roomId, user.id, supabase);
  revalidatePath(`/app/focus/${roomId}`);
}

export async function startRoom(roomId: string) {
  if (!uuid.safeParse(roomId).success) redirect("/app/focus");
  const { supabase, user } = await requireUser(`/app/focus/${roomId}`);
  await supabase
    .from("gk_focus_rooms")
    .update({ started_at: new Date().toISOString(), status: "running" })
    .eq("id", roomId)
    .eq("host_id", user.id)
    .eq("status", "waiting");
  revalidatePath(`/app/focus/${roomId}`);
}

export async function saveIntention(roomId: string, fd: FormData) {
  if (!uuid.safeParse(roomId).success) redirect("/app/focus");
  const { supabase, user } = await requireUser(`/app/focus/${roomId}`);
  const intention = z.string().trim().max(140).safeParse(str(fd, "intention") ?? "");
  if (!intention.success) return;
  await supabase.from("gk_focus_participants").update({ intention: intention.data || null }).eq("room_id", roomId).eq("user_id", user.id);
  revalidatePath(`/app/focus/${roomId}`);
}

export async function saveDoneNote(roomId: string, fd: FormData) {
  if (!uuid.safeParse(roomId).success) redirect("/app/focus");
  const { supabase, user } = await requireUser(`/app/focus/${roomId}`);
  const note = z.string().trim().max(500).safeParse(str(fd, "done_note") ?? "");
  if (!note.success) return;
  await supabase.from("gk_focus_participants").update({ done_note: note.data || null }).eq("room_id", roomId).eq("user_id", user.id);
  revalidatePath(`/app/focus/${roomId}`);
}

export async function leaveRoom(roomId: string) {
  if (!uuid.safeParse(roomId).success) redirect("/app/focus");
  const { supabase, user } = await requireUser(`/app/focus/${roomId}`);
  await supabase.from("gk_focus_participants").delete().eq("room_id", roomId).eq("user_id", user.id);
  revalidatePath("/app/focus");
  redirect("/app/focus");
}
