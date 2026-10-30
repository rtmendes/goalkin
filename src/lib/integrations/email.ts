// Email via the Resend REST API. Without RESEND_API_KEY it logs and skips, so
// local development and preview deployments never send real mail.
import { env, serverEnv } from "@/lib/env";
import { reminderText, weeklySummaryLine } from "@/lib/tone";
import type { Tone } from "@/lib/types";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult = { ok: true; id: string } | { ok: false; skipped: true } | { ok: false; error: string };

export async function sendEmail(msg: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const { resendKey, emailFrom } = serverEnv();
  if (!resendKey) {
    console.info(`[email] RESEND_API_KEY not set; skipped "${msg.subject}" to ${msg.to.replace(/^(.).*@/, "$1***@")}`);
    return { ok: false, skipped: true };
  }
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: emailFrom,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers: { "List-Unsubscribe": `<${manageUrl()}>` },
    }),
  });
  if (!res.ok) return { ok: false, error: `resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const body = (await res.json()) as { id?: string };
  return { ok: true, id: body.id ?? "" };
}

export const manageUrl = () => `${env.appUrl}/app/settings#notifications`;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

type Btn = { label: string; href: string; color?: string };

const NAVY = "#14213D";
const GOLD = "#C9A86A";
const IVORY = "#F7F3EC";
const SAGE = "#2F7D6D";
const CORAL = "#B23A1E";

function layout(opts: { preheader: string; heading: string; paragraphs: string[]; buttons?: Btn[]; footerNote?: string }): string {
  const btns = (opts.buttons ?? [])
    .map((b) => `<a href="${escapeHtml(b.href)}" style="display:inline-block;margin:4px 6px 4px 0;padding:12px 18px;border-radius:12px;background:${b.color ?? NAVY};color:#ffffff;font-weight:700;text-decoration:none">${escapeHtml(b.label)}</a>`)
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;background:${IVORY};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:${NAVY}">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d9d1c3;border-radius:16px">
<tr><td style="padding:20px 24px 0;font-family:Nunito,Inter,Arial,sans-serif;font-size:22px;font-weight:900">Goal<span style="color:${GOLD}">Kin</span></td></tr>
<tr><td style="padding:12px 24px 24px">
<h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;margin:0 0 12px">${escapeHtml(opts.heading)}</h1>
${opts.paragraphs.map((p) => `<p style="font-size:16px;line-height:1.5;margin:0 0 12px">${escapeHtml(p)}</p>`).join("\n")}
${btns ? `<p style="margin:16px 0 0">${btns}</p>` : ""}
</td></tr></table>
<p style="max-width:560px;font-size:12px;line-height:1.5;color:#4a5468;margin:16px auto 0">${opts.footerNote ? escapeHtml(opts.footerNote) : `You get this because you turned it on in GoalKin. <a href="${escapeHtml(manageUrl())}" style="color:#4a5468">Manage or turn off reminders</a>.`}</p>
</td></tr></table></body></html>`;
}

function textBody(lines: string[], buttons: Btn[] = [], footer = `Manage or turn off reminders: ${manageUrl()}`): string {
  return [...lines, "", ...buttons.map((b) => `${b.label}: ${b.href}`), "", footer].join("\n");
}

export interface CheckinLinks { done: string; partly: string; missed: string }

function checkinButtons(links: CheckinLinks): Btn[] {
  return [
    { label: "✓ Done", href: links.done, color: SAGE },
    { label: "◐ Partly", href: links.partly, color: NAVY },
    { label: "✕ Missed", href: links.missed, color: CORAL },
  ];
}

export function dailyReminderEmail(input: {
  tone: Tone; name?: string | null; goal: string; action?: string; streak?: number; missedDays?: number; links: CheckinLinks;
}): Omit<EmailMessage, "to"> {
  const { subject, body } = reminderText(input.tone, input);
  const buttons = checkinButtons(input.links);
  const paragraphs = [body, "One tap records today's check-in. You can add a note in the app."];
  return { subject, html: layout({ preheader: body, heading: input.goal, paragraphs, buttons }), text: textBody(paragraphs, buttons) };
}

export function weeklyRecapEmail(input: {
  tone: Tone; name?: string | null; goals: { title: string; done: number; planned: number; percent: number; streak: number }[];
}): Omit<EmailMessage, "to"> {
  const paragraphs = input.goals.map((g) => `${g.title}: ${weeklySummaryLine(input.tone, g.done, g.planned)} Overall ${g.percent}% done${g.streak > 1 ? `, ${g.streak}-day run` : ""}.`);
  const heading = input.name ? `Your week, ${input.name}` : "Your week";
  const buttons = [{ label: "Plan next week", href: `${env.appUrl}/app` }];
  return { subject: "Your GoalKin week in review", html: layout({ preheader: paragraphs[0] ?? heading, heading, paragraphs, buttons }), text: textBody([heading, ...paragraphs], buttons) };
}

export function partnerQuietEmail(input: { partner: string; goal: string; days: number; circleUrl: string }): Omit<EmailMessage, "to"> {
  const paragraphs = [
    `${input.partner} hasn't checked in on "${input.goal}" for ${input.days} days.`,
    "A short, kind note often helps more than a reminder. No pressure, just a nudge from someone in their corner.",
  ];
  const buttons = [{ label: "Send encouragement", href: input.circleUrl }];
  return { subject: `${input.partner} could use a nudge`, html: layout({ preheader: paragraphs[0], heading: "Someone in your circle went quiet", paragraphs, buttons }), text: textBody(paragraphs, buttons) };
}

export function inviteEmail(input: { inviter: string; goal?: string | null; circle?: string | null; inviteUrl: string; preview?: string[] }): Omit<EmailMessage, "to"> {
  const what = input.circle ? `the circle "${input.circle}"` : input.goal ? `their goal "${input.goal}"` : "GoalKin";
  const paragraphs = [`${input.inviter} invited you to ${what}.`];
  if (input.preview?.length) paragraphs.push(`You'll be able to see: ${input.preview.join(", ")}. Everything else stays private.`);
  paragraphs.push("GoalKin turns goals into calendar plans, with someone in your corner.");
  const buttons = [{ label: "Accept invite", href: input.inviteUrl }];
  return {
    subject: `${input.inviter} wants you in their corner`,
    html: layout({ preheader: paragraphs[0], heading: "You're invited", paragraphs, buttons, footerNote: "If you weren't expecting this, you can ignore it." }),
    text: textBody(paragraphs, buttons, "If you weren't expecting this, you can ignore it."),
  };
}
