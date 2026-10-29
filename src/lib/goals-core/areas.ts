// The eight life areas, each with its own accent so cards are easy to tell apart.
// The accent is only decoration: every card also has an icon and a text label.

export const AREAS = [
  { id: "Health", label: "Health", icon: "♥", accent: "#FF6B4A", blurb: "Move, rest, feel strong" },
  { id: "Wealth", label: "Wealth", icon: "$", accent: "#C9A86A", blurb: "Save, pay off, build" },
  { id: "Work and career", label: "Work and career", icon: "⚑", accent: "#3B5BA9", blurb: "Skills, side projects, next steps" },
  { id: "Relationships", label: "Relationships", icon: "☺", accent: "#D9467A", blurb: "Family, friends, partner" },
  { id: "Faith and spirit", label: "Faith and spirit", icon: "✦", accent: "#7B5EA7", blurb: "Prayer, reading, stillness" },
  { id: "Learning and growth", label: "Learning and growth", icon: "✎", accent: "#2F7D6D", blurb: "Books, languages, new skills" },
  { id: "Home and life", label: "Home and life", icon: "⌂", accent: "#E0912F", blurb: "Declutter, fix, organize" },
  { id: "Giving and community", label: "Giving and community", icon: "✿", accent: "#4C9A2A", blurb: "Volunteer, raise, serve" },
] as const;

export type AreaId = (typeof AREAS)[number]["id"];

export function areaInfo(area: string | null | undefined) {
  return AREAS.find((a) => a.id === area) ?? { id: area ?? "Other", label: area ?? "Other", icon: "◎", accent: "#2F7D6D", blurb: "" };
}

/** Tinted background that works in light and dark themes (mixes with the surface token). */
export function areaTint(accent: string, pct = 16) {
  return { backgroundColor: `color-mix(in srgb, ${accent} ${pct}%, var(--surface))`, borderColor: `color-mix(in srgb, ${accent} 55%, var(--line))` };
}
