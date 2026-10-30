import type { Tone } from "@/lib/types";

export const TONES: { id: Tone; name: string; blurb: string; sample: string; defaultCadence: "daily" | "weekdays" | "weekly" }[] = [
  { id: "gentle", name: "Gentle", blurb: "Warm, patient, no pressure.", sample: "Hi friend. Your 15 minutes is waiting whenever you're ready. Small steps still count.", defaultCadence: "weekly" },
  { id: "coach", name: "Coach", blurb: "Clear, encouraging, keeps you moving.", sample: "Today's play: a 20-minute run. You did it Tuesday, you can do it today. Tap when done.", defaultCadence: "weekdays" },
  { id: "drill", name: "Drill Sergeant", blurb: "Blunt, short, all business.", sample: "20 minutes. Shoes on. No debate. Report back.", defaultCadence: "daily" },
  { id: "playful", name: "Playful", blurb: "Light, funny, a little cheeky.", sample: "Your Bible reading called. It misses you. Want to grab 15 minutes together?", defaultCadence: "daily" },
];

type Ctx = { name?: string | null; goal: string; action?: string; streak?: number; missedDays?: number };

export function reminderText(tone: Tone, c: Ctx): { subject: string; body: string } {
  const who = c.name ? `${c.name}` : "";
  const act = c.action ?? "your next step";
  const streak = c.streak && c.streak > 1 ? c.streak : 0;
  switch (tone) {
    case "gentle":
      return {
        subject: `A small step for "${c.goal}"`,
        body: c.missedDays
          ? `${who ? who + ", " : ""}no worries about the last few days. When you're ready: ${act}. Even a little counts.`
          : `${who ? "Hi " + who + ". " : ""}Whenever it suits you today: ${act}.${streak ? ` You're on a ${streak}-day run.` : ""}`,
      };
    case "drill":
      return {
        subject: `${c.goal}: report in`,
        body: c.missedDays ? `${c.missedDays} days off. Back on it. ${act}. Now.` : `${act}. Get it done. Check in.${streak ? ` Streak: ${streak}.` : ""}`,
      };
    case "playful":
      return {
        subject: `Psst... "${c.goal}" wants to hang out`,
        body: c.missedDays
          ? `We saved your seat. ${act}? Your goal promises not to be weird about it.`
          : `${act} is on the menu today.${streak ? ` ${streak} days strong. Show-off.` : ""} Tap to check in.`,
      };
    default:
      return {
        subject: `Today for "${c.goal}"`,
        body: c.missedDays
          ? `Welcome back. Restart small: ${act}. One good day starts the next run.`
          : `Today's play: ${act}.${streak ? ` ${streak} days in a row. Keep it rolling.` : ""} Tap when done.`,
      };
  }
}

export function weeklySummaryLine(tone: Tone, done: number, planned: number): string {
  const pct = planned ? Math.round((done / planned) * 100) : 0;
  switch (tone) {
    case "gentle": return `You showed up ${done} time${done === 1 ? "" : "s"} this week. That matters.`;
    case "drill": return `${done}/${planned}. ${pct >= 80 ? "Acceptable. Hold the line." : "Not enough. Tighten up."}`;
    case "playful": return `${done} out of ${planned}! ${pct >= 80 ? "Somebody's on fire." : "Next week's yours, champ."}`;
    default: return `${done} of ${planned} done (${pct}%). ${pct >= 80 ? "Strong week." : "Pick one thing to make easier next week."}`;
  }
}

export const MISSED_DAY_ENCOURAGEMENTS = [
  "Missing a day doesn't undo the ones you did. Want to do a short version today?",
  "I'm still in your corner. What's one small thing you can do this week?",
  "Rough week? Same. Let's both do one thing tomorrow and check in.",
  "You've done harder things than this. Restart small. I'll cheer.",
];
