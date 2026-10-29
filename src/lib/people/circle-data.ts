import "server-only";
import { loadSharedGoal } from "@/lib/goals";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SharedGoalView } from "@/lib/visibility";
import { isQuiet } from "@/lib/people/quiet";
import { voicePathOwner } from "@/lib/people/invites";
import type { Member } from "@/lib/people/server";

export interface Layer {
  goalId: string;
  ownerId: string;
  ownerName: string;
  /** Filtered view for the viewer, or null when the owner keeps it private. */
  view: SharedGoalView | null;
  mine: boolean;
  quiet: boolean;
}

/**
 * Member layers under the circle's shared goal, each read ONLY through
 * loadSharedGoal so the viewer sees exactly what the owner chose.
 */
export async function loadLayers(args: { circleId: string; sharedGoalId: string; viewerId: string; members: Member[]; today?: Date }): Promise<Layer[]> {
  const { data } = await createAdminClient()
    .from("gk_goals")
    .select("id, owner_id")
    .eq("parent_goal_id", args.sharedGoalId)
    .eq("circle_id", args.circleId);
  const byId = new Map(args.members.map((m) => [m.user_id, m]));
  const rows = ((data ?? []) as { id: string; owner_id: string }[]).filter((r) => byId.has(r.owner_id));
  const views = await Promise.all(rows.map((r) => loadSharedGoal(r.id, args.viewerId)));
  return rows
    .map((r, i) => ({
      goalId: r.id,
      ownerId: r.owner_id,
      ownerName: byId.get(r.owner_id)?.name ?? "A member",
      view: views[i],
      mine: r.owner_id === args.viewerId,
      quiet: r.owner_id !== args.viewerId && isQuiet(views[i], args.today),
    }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.ownerName.localeCompare(b.ownerName));
}

export interface FeedItem {
  id: string;
  kind: "note" | "reaction" | "voice" | "video";
  body: string | null;
  fromName: string;
  toName: string | null;
  mine: boolean;
  created_at: string;
  audioUrl: string | null;
}

/**
 * Signed URLs for voice notes. Callers must already have checked that the viewer is
 * a circle member; the path must sit in the sender's own folder.
 */
export async function signVoice(rows: { from_id: string; media_url: string | null }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const paths = rows.filter((r) => r.media_url && voicePathOwner(r.media_url) === r.from_id).map((r) => r.media_url as string);
  if (!paths.length) return out;
  try {
    const { data } = await createAdminClient().storage.from("gk-media").createSignedUrls(paths, 60 * 60);
    for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
  } catch {
    /* audio just won't play; the rest of the feed still renders */
  }
  return out;
}
