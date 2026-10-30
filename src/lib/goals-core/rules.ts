// Pure rules shared by the goals actions (validated again on the server).

import * as z from "zod/v4";
import { RINGS } from "@/lib/visibility";
import type { SummaryVisibility, Visibility } from "@/lib/types";

/** Keep a ring within what the plan allows; anything wider falls back to the widest allowed ring below it. */
export function clampRing(v: Visibility, allowed: Visibility[]): Visibility {
  if (allowed.includes(v)) return v;
  for (let i = RINGS.indexOf(v); i >= 0; i--) if (allowed.includes(RINGS[i])) return RINGS[i];
  return "private";
}

export type SummaryKey = keyof Omit<SummaryVisibility, "goal_id">;
export const SUMMARY_KEYS: { key: SummaryKey; label: string; hint: string }[] = [
  { key: "status", label: "On track or behind", hint: "The status word, plus which days you checked in" },
  { key: "percent", label: "Percent complete", hint: "One number, like 42%" },
  { key: "streak", label: "Streak", hint: "Days in a row" },
  { key: "plan", label: "Plan", hint: "Your plan items and which are done" },
  { key: "why", label: "Why it matters", hint: "Your note (photos and voice memos stay private)" },
  { key: "check_in_notes", label: "Check-in notes", hint: "What you wrote when checking in" },
  { key: "photos", label: "Check-in photos", hint: "Photos you added to check-ins" },
];

export const ringSchema = z.enum(["private", "chosen", "circle", "public"]);
export const toneSchema = z.enum(["gentle", "coach", "drill", "playful"]);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s + "T00:00:00Z")), "Invalid date");
export const summarySchema = z.object({
  status: ringSchema, percent: ringSchema, streak: ringSchema, plan: ringSchema,
  why: ringSchema, check_in_notes: ringSchema, photos: ringSchema,
});

export const SLOT_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const SLOT_PARTS = ["morning", "midday", "evening"] as const;
export const slotSchema = z.string().regex(/^(mon|tue|wed|thu|fri|sat|sun)-(morning|midday|evening)$/);

/** Rough minutes a week from tapped slots (about 30 minutes each). */
export const minutesFromSlots = (slots: string[]) => (slots.length ? slots.length * 30 : null);

export const onboardingSchema = z.object({
  area: z.string().max(60).nullable(),
  templateId: z.string().regex(/^[a-z0-9-]+$/).max(80).nullable(),
  title: z.string().trim().min(2).max(140),
  finishDate: dateSchema.nullable(),
  answers: z.record(z.string().max(60), z.union([z.string().max(500), z.number(), z.boolean(), z.array(z.string().max(120)).max(30)])).default({}),
  approachAnswers: z.record(z.string().max(30), z.number().int().min(0).max(10)).default({}),
  readiness: z.record(z.string().max(30), z.number().int().min(1).max(5)).default({}),
  slots: z.array(slotSchema).max(21).default([]),
  trackingMode: z.enum(["detailed", "simple", "reflective"]).default("simple"),
  tone: toneSchema.default("coach"),
  visibility: ringSchema.default("private"),
  summary: summarySchema,
  fieldVisibility: z.record(z.string().max(60), ringSchema).default({}),
  invites: z.array(z.email().max(200)).max(5).default([]),
  why: z.string().trim().max(1000).nullable(),
  whyMediaPath: z.string().max(300).nullable(),
  starter: z.string().trim().max(140).nullable(),
});
export type OnboardingPayload = z.infer<typeof onboardingSchema>;

/** A media path must live in the person's own folder of the gk-media bucket. */
export function ownsMediaPath(path: string | null | undefined, userId: string, folder: "why" | "checkins"): boolean {
  if (!path) return false;
  return path.startsWith(`${userId}/${folder}/`) && !path.includes("..") && /^[\w\-./]+$/.test(path);
}

/** Starter action so day one ends with a check mark. */
export function starterFor(area: string | null | undefined, title: string): string {
  switch (area) {
    case "Health": return "Put your shoes by the door and take a 2-minute walk.";
    case "Wealth": return "Write down one number: what's in your main account right now.";
    case "Work and career": return "Write the very next tiny step on a sticky note.";
    case "Relationships": return "Send one kind message to someone this goal is about.";
    case "Faith and spirit": return "Take two quiet minutes: one breath, one thank-you.";
    case "Learning and growth": return "Open the book, app or course and do just two minutes.";
    case "Home and life": return "Set a 2-minute timer and clear one small surface.";
    case "Giving and community": return "Look up one place you could help and save the link.";
    default: return `Spend two minutes on the first step of "${title.slice(0, 60)}".`;
  }
}
