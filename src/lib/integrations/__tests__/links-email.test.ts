import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkinPath, checkinToken, checkinUrl, verifyCheckinToken } from "@/lib/integrations/links";
import { dailyReminderEmail, escapeHtml, inviteEmail, partnerQuietEmail, sendEmail } from "@/lib/integrations/email";

const KEY = "test-secret";

describe("check-in links", () => {
  it("signs goalId:day:userId with HMAC-SHA256 (same scheme as signCheckinLink)", () => {
    const want = createHmac("sha256", KEY).update("g1:2026-11-03:u1").digest("hex");
    expect(checkinToken("g1", "2026-11-03", "u1", KEY)).toBe(want);
    expect(checkinPath("g1", "u1", "2026-11-03", "done", KEY)).toBe(`/api/checkin?g=g1&d=2026-11-03&s=done&t=${want}`);
  });
  it("verifies only matching tokens", () => {
    const t = checkinToken("g1", "2026-11-03", "u1", KEY);
    expect(verifyCheckinToken("g1", "2026-11-03", "u1", t, KEY)).toBe(true);
    expect(verifyCheckinToken("g1", "2026-11-04", "u1", t, KEY)).toBe(false);
    expect(verifyCheckinToken("g1", "2026-11-03", "u1", "nope", KEY)).toBe(false);
    expect(verifyCheckinToken("g1", "2026-11-03", "u1", t, "")).toBe(false);
  });
  it("falls back to the app instead of an unsigned link when no secret is set", () => {
    expect(checkinUrl("g1", "u1", "2026-11-03", "done", "")).toMatch(/\/app$/);
  });
});

describe("email templates", () => {
  const links = { done: "https://a/d?x=1&y=2", partly: "https://a/p", missed: "https://a/m" };
  it("escapes HTML", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;");
  });
  it("builds a tone-aware daily reminder with three check-in buttons and a manage link", () => {
    const m = dailyReminderEmail({ tone: "drill", goal: "Run <5K>", action: "20 minutes", links });
    expect(m.subject).toBe("Run <5K>: report in");
    expect(m.html).toContain("Run &lt;5K&gt;");
    expect(m.html).not.toContain("<5K>");
    expect(m.html).toContain("https://a/d?x=1&amp;y=2");
    for (const label of ["Done", "Partly", "Missed"]) expect(m.text).toContain(label);
    expect(m.text).toContain("/app/settings#notifications");
  });
  it("words partner and invite emails without exposing more than given", () => {
    expect(partnerQuietEmail({ partner: "Sam", goal: "Read daily", days: 5, circleUrl: "https://a/c" }).text).toContain("Sam hasn't checked in on \"Read daily\" for 5 days.");
    const inv = inviteEmail({ inviter: "Ana", goal: "Save $500", inviteUrl: "https://a/i", preview: ["status", "streak"] });
    expect(inv.text).toContain("You'll be able to see: status, streak. Everything else stays private.");
    expect(inv.text).not.toContain("Manage or turn off reminders");
  });
  it("skips sending without RESEND_API_KEY", async () => {
    const prev = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    let called = false;
    const res = await sendEmail({ to: "a@b.c", subject: "s", html: "h", text: "t" }, (async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch);
    expect(res).toEqual({ ok: false, skipped: true });
    expect(called).toBe(false);
    if (prev !== undefined) process.env.RESEND_API_KEY = prev;
  });
});
