// Pure helpers for invites, circle codes and the frozen "what you'll share" preview.

import * as z from "zod";

export const CIRCLE_JOIN_SHARES = "Joining shares your name and anything you set to Circle. Your goals stay private unless you choose.";

/** gk_invites.token: 16 random bytes as hex. */
export const isInviteToken = (t: string) => /^[a-f0-9]{32}$/.test(t);
/** gk_circles.invite_code: hex, 18 chars by default; allow a little room for regenerated codes. */
export const isCircleCode = (c: string) => /^[a-f0-9]{12,48}$/.test(c);
/** gk_focus_rooms.invite_code: 6 random bytes as hex. */
export const isRoomCode = (c: string) => /^[a-f0-9]{12}$/.test(c);

export interface CirclePreview {
  kind: "circle";
  circle_name: string;
  leader_name: string;
  shares: string;
  points: string[];
}

export function circleInvitePreview(args: { circleName: string; leaderName: string }): CirclePreview {
  return {
    kind: "circle",
    circle_name: args.circleName,
    leader_name: args.leaderName,
    shares: CIRCLE_JOIN_SHARES,
    points: [
      "Members see your display name.",
      "Members see goals or numbers you set to Circle, and nothing else.",
      "Everything starts Private. You choose what to share, number by number.",
      "You can leave the circle at any time.",
    ],
  };
}

const goalViewSchema = z.object({
  title: z.string(),
  area: z.string().nullish(),
  finish_date: z.string().nullish(),
  status: z.enum(["on_track", "behind", "finished", "not_started"]).optional(),
  percent: z.number().optional(),
  streak: z.number().optional(),
  why: z.string().nullish(),
  plan: z.array(z.object({ title: z.string(), week: z.number().nullish(), done: z.boolean().optional() })).optional(),
  fields: z
    .array(z.object({ label: z.string(), unit: z.string().nullish(), latest: z.number().nullish(), total: z.number().nullish(), target: z.number().nullish() }))
    .optional()
    .default([]),
  recent: z.array(z.object({ day: z.string(), status: z.string(), note: z.string().nullish() })).optional().default([]),
  hidden_count: z.number().optional().default(0),
});
export type GoalPreview = z.infer<typeof goalViewSchema>;

const circlePreviewSchema = z.object({
  kind: z.literal("circle"),
  circle_name: z.string().optional(),
  leader_name: z.string().optional(),
  shares: z.string().optional(),
  points: z.array(z.string()).optional(),
});

export type ReadPreview =
  | { type: "circle"; preview: z.infer<typeof circlePreviewSchema> }
  | { type: "goal"; view: GoalPreview; ring?: string; note?: string }
  | { type: "unknown" };

/**
 * Read a frozen invite preview. Goal invites may store the SharedGoalView directly
 * or wrap it as { kind: "goal", view, ring? }; anything unrecognized renders as
 * "nothing shown yet" instead of guessing.
 */
export function readInvitePreview(raw: unknown): ReadPreview {
  if (!raw || typeof raw !== "object") return { type: "unknown" };
  const circle = circlePreviewSchema.safeParse(raw);
  if (circle.success) return { type: "circle", preview: circle.data };
  const obj = raw as Record<string, unknown>;
  const inner = obj.view ?? obj.preview ?? obj;
  const view = goalViewSchema.safeParse(inner);
  if (view.success) {
    return {
      type: "goal",
      view: view.data,
      ring: typeof obj.ring === "string" ? obj.ring : typeof obj.audience === "string" ? obj.audience : undefined,
      note: typeof obj.note === "string" ? obj.note : typeof obj.message === "string" ? obj.message : undefined,
    };
  }
  return { type: "unknown" };
}

export const REACTIONS = [
  { emoji: "👏", label: "Applause" },
  { emoji: "🔥", label: "On fire" },
  { emoji: "💪", label: "Strong work" },
  { emoji: "❤️", label: "Love this" },
  { emoji: "🙌", label: "Proud of you" },
  { emoji: "🌱", label: "Keep growing" },
] as const;

export const reactionBody = (i: number) => {
  const r = REACTIONS[i];
  return r ? `${r.emoji} ${r.label}` : null;
};

/** Voice notes live under the sender's own folder: <userId>/voice/<uuid>.webm */
export const VOICE_PATH = /^([0-9a-f-]{36})\/voice\/[0-9a-f-]{36}\.webm$/;
export function voicePathOwner(path: string): string | null {
  return VOICE_PATH.exec(path)?.[1] ?? null;
}
