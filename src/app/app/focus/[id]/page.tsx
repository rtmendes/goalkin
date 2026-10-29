import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { FocusRoom } from "@/components/focus/focus-room";
import { Flash } from "@/components/people/flash";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { loadRoomState } from "@/lib/people/focus-data";
import { joinRoom, leaveRoom, saveDoneNote, saveIntention, startRoom } from "../actions";

export const metadata: Metadata = { title: "Focus room" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FocusRoomPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ n?: string }> }) {
  const { id } = await params;
  const { n } = await searchParams;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await requireUser(`/app/focus/${id}`);
  const room = await loadRoomState(supabase, id, user.id);
  if (!room) notFound();
  const inviteUrl = `${env.appUrl.replace(/\/$/, "")}/app/focus?join=${room.invite_code}`;

  return (
    <div className="space-y-4">
      <p className="text-sm"><Link href="/app/focus" className="underline">← All focus rooms</Link></p>
      <PageHeader title={room.name} sub="Work side by side. One shared timer, one check-in at the end." />
      <Flash code={n} />
      <FocusRoom
        initial={room}
        meId={user.id}
        inviteUrl={inviteUrl}
        actions={{
          start: startRoom.bind(null, id),
          join: joinRoom.bind(null, id),
          leave: leaveRoom.bind(null, id),
          intention: saveIntention.bind(null, id),
          doneNote: saveDoneNote.bind(null, id),
        }}
      />
    </div>
  );
}
