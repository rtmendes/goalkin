"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCircleCode } from "@/lib/people/invites";
import { addMember } from "@/lib/people/server";

export async function joinByCode(code: string) {
  if (!isCircleCode(code)) redirect("/");
  const { user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  const { data: circle } = await createAdminClient().from("gk_circles").select("id, max_members").eq("invite_code", code).maybeSingle();
  if (!circle) redirect(`/join/${code}`);
  const result = await addMember(circle as { id: string; max_members: number }, user.id);
  if (result === "full" || result === "missing") redirect(`/join/${code}?n=${result === "full" ? "full" : "failed"}`);
  revalidatePath("/app/circles");
  redirect(`/app/circles/${circle.id}?n=${result === "already" ? "already" : "joined"}`);
}
