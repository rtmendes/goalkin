// Store or remove this device's web push subscription for the signed-in person (RLS client).
import * as z from "zod";
import { createClient } from "@/lib/supabase/server";

const Sub = z.object({
  endpoint: z.url().max(2000).refine((u) => u.startsWith("https://"), "https only"),
  keys: z.object({ p256dh: z.string().min(16).max(256), auth: z.string().min(8).max(128) }),
});
const Del = z.object({ endpoint: z.url().max(2000) });

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export async function POST(req: Request) {
  const { supabase, user } = await signedIn();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That subscription looks invalid." }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  const { error } = await supabase
    .from("gk_push_subscriptions")
    .upsert({ user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
  if (error) return Response.json({ error: "Could not save this device." }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { supabase, user } = await signedIn();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const parsed = Del.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Missing endpoint." }, { status: 400 });
  await supabase.from("gk_push_subscriptions").delete().eq("endpoint", parsed.data.endpoint).eq("user_id", user.id);
  return Response.json({ ok: true });
}
