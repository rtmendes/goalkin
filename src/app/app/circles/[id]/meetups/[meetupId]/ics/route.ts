import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { icsFilename, meetupIcs } from "@/lib/people/ics";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; meetupId: string }> }) {
  const { id, meetupId } = await params;
  if (!UUID.test(id) || !UUID.test(meetupId)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Sign in first", { status: 401 });

  // RLS lets only circle members read meetups and the circle.
  const [{ data: meetup }, { data: circle }] = await Promise.all([
    supabase.from("gk_meetups").select("id, title, starts_at, duration_min, link").eq("id", meetupId).eq("circle_id", id).maybeSingle(),
    supabase.from("gk_circles").select("name").eq("id", id).maybeSingle(),
  ]);
  if (!meetup || !circle) return new Response("Not found", { status: 404 });

  const body = meetupIcs({
    id: meetup.id as string,
    title: meetup.title as string,
    startsAt: meetup.starts_at as string,
    durationMin: meetup.duration_min as number,
    link: meetup.link as string | null,
    circleName: circle.name as string,
    circleUrl: `${env.appUrl.replace(/\/$/, "")}/app/circles/${id}`,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFilename(meetup.title as string)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
