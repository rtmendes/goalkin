// Approach profile (PRD §5): five quick questions, each answer nudges the
// weights; the plan builder blends the approaches by weight.
import type { Approach, ApproachWeights } from "@/lib/types";

export const APPROACHES: { id: Approach; name: string; fits: string; changes: string }[] = [
  { id: "habit", name: "Habit builder", fits: "Likes routines and streaks", changes: "Tiny daily actions stacked on existing habits, streak tracking" },
  { id: "willpower", name: "Willpower and challenge", fits: "Likes a hard push and a finish line", changes: "Bold targets, countdowns, dares from partners" },
  { id: "time", name: "Time manager", fits: "Lives by the calendar", changes: "Every action is a calendar block; weekly review of time spent" },
  { id: "reward", name: "Reward driven", fits: "Motivated by what they earn", changes: "Rewards you choose at each milestone" },
  { id: "resource", name: "Resource planner", fits: "Stalls on 'I don't have what I need'", changes: "Plan starts with gathering money, tools, people and skills" },
];

export const APPROACH_QUESTIONS: { id: string; prompt: string; options: { label: string; nudge: Partial<ApproachWeights> }[] }[] = [
  {
    id: "past_win",
    prompt: "Think of a goal you finished. What got you there?",
    options: [
      { label: "Doing a little every day", nudge: { habit: 2 } },
      { label: "A big push to a deadline", nudge: { willpower: 2 } },
      { label: "Blocking time on my calendar", nudge: { time: 2 } },
      { label: "Promising myself a treat", nudge: { reward: 2 } },
      { label: "Getting everything I needed first", nudge: { resource: 2 } },
    ],
  },
  {
    id: "stall",
    prompt: "When you stall, it's usually because...",
    options: [
      { label: "I break the routine once and drift", nudge: { habit: 1.5 } },
      { label: "It gets boring without a challenge", nudge: { willpower: 1.5 } },
      { label: "Other things fill my time", nudge: { time: 1.5 } },
      { label: "Nothing feels worth it yet", nudge: { reward: 1.5 } },
      { label: "I'm missing money, tools, or help", nudge: { resource: 1.5 } },
    ],
  },
  {
    id: "monday",
    prompt: "Pick the Monday you'd enjoy most.",
    options: [
      { label: "Same calm routine as always", nudge: { habit: 1 } },
      { label: "A tough challenge to beat", nudge: { willpower: 1 } },
      { label: "A tidy, color-coded calendar", nudge: { time: 1 } },
      { label: "Something to look forward to after", nudge: { reward: 1 } },
      { label: "Everything ready before I start", nudge: { resource: 1 } },
    ],
  },
  {
    id: "push",
    prompt: "Which nudge works on you?",
    options: [
      { label: "Don't break the chain", nudge: { habit: 1, willpower: 0.5 } },
      { label: "Bet you can't", nudge: { willpower: 1.5 } },
      { label: "It's 6pm, it's on your calendar", nudge: { time: 1.5 } },
      { label: "Two more and you unlock it", nudge: { reward: 1.5 } },
      { label: "Here's a checklist of what you need", nudge: { resource: 1.5 } },
    ],
  },
  {
    id: "finish",
    prompt: "How do you want to feel at the finish?",
    options: [
      { label: "Like it became part of me", nudge: { habit: 1 } },
      { label: "Like I conquered something", nudge: { willpower: 1 } },
      { label: "Like my time went where I wanted", nudge: { time: 1 } },
      { label: "Like I earned something great", nudge: { reward: 1 } },
      { label: "Like I was ready for it", nudge: { resource: 1 } },
    ],
  },
];

export function scoreApproach(answers: Record<string, number>): ApproachWeights {
  const raw: ApproachWeights = { habit: 1, willpower: 1, time: 1, reward: 1, resource: 1 };
  for (const q of APPROACH_QUESTIONS) {
    const idx = answers[q.id];
    const opt = typeof idx === "number" ? q.options[idx] : undefined;
    if (!opt) continue;
    for (const [k, v] of Object.entries(opt.nudge)) raw[k as Approach] += v ?? 0;
  }
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.round((v / total) * 100) / 100])) as ApproachWeights;
}

export function topApproaches(w: ApproachWeights, n = 2): Approach[] {
  return (Object.entries(w) as [Approach, number][]).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

// Readiness check: 1 (not at all) to 5 (fully). Low readiness shrinks the first phase.
export const READINESS_QUESTIONS: { id: string; prompt: string; low: string; high: string }[] = [
  { id: "time", prompt: "Do you have the time this needs?", low: "Barely", high: "Plenty" },
  { id: "energy", prompt: "How's your energy these days?", low: "Running on empty", high: "Charged up" },
  { id: "money", prompt: "Do you have the money or tools it needs?", low: "Not yet", high: "All set" },
  { id: "support", prompt: "Is anyone backing you?", low: "Just me", high: "Whole crew" },
  { id: "focus", prompt: "How much else is competing for you right now?", low: "A lot", high: "Very little" },
];

export function readinessScale(r: Record<string, number>): { score: number; firstPhaseScale: number; clearPath: string[] } {
  const vals = READINESS_QUESTIONS.map((q) => Number(r[q.id] ?? 3));
  const score = vals.reduce((a, b) => a + b, 0) / vals.length;
  const firstPhaseScale = score < 2.5 ? 0.5 : score < 3.5 ? 0.75 : 1;
  const clearPath: string[] = [];
  if ((r.time ?? 3) <= 2) clearPath.push("Find two 20-minute slots this week and protect them on your calendar.");
  if ((r.energy ?? 3) <= 2) clearPath.push("Start with the smallest version of each action; energy grows with momentum.");
  if ((r.money ?? 3) <= 2) clearPath.push("List what you need and the cheapest way to get each item before you start.");
  if ((r.support ?? 3) <= 2) clearPath.push("Invite one person into your corner, even just to see 'on track' or 'behind'.");
  if ((r.focus ?? 3) <= 2) clearPath.push("Pick one thing to pause or drop so this goal has room.");
  return { score: Math.round(score * 10) / 10, firstPhaseScale, clearPath };
}
