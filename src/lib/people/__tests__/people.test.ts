import { describe, expect, it } from "vitest";
import { daysSinceLastCheckIn, isQuiet } from "@/lib/people/quiet";
import { icsEscape, icsFold, icsFilename, meetupIcs } from "@/lib/people/ics";
import { circleInvitePreview, isCircleCode, isInviteToken, isRoomCode, reactionBody, readInvitePreview, voicePathOwner } from "@/lib/people/invites";
import { formatWhen, localToUtc } from "@/lib/people/time";

describe("meetup time zones", () => {
  it("reads a local time in the profile zone", () => {
    expect(localToUtc("2026-11-01T18:00", "UTC")?.toISOString()).toBe("2026-11-01T18:00:00.000Z");
    // New York is UTC-4 before Nov 1 2026 02:00 and UTC-5 after.
    expect(localToUtc("2026-10-29T09:30", "America/New_York")?.toISOString()).toBe("2026-10-29T13:30:00.000Z");
    expect(localToUtc("2026-11-02T09:30", "America/New_York")?.toISOString()).toBe("2026-11-02T14:30:00.000Z");
  });
  it("falls back to UTC for an unknown zone and rejects junk", () => {
    expect(localToUtc("2026-11-01T18:00", "Mars/Olympus")?.toISOString()).toBe("2026-11-01T18:00:00.000Z");
    expect(localToUtc("tomorrow", "UTC")).toBeNull();
  });
  it("formats in the viewer's zone", () => {
    expect(formatWhen("2026-10-29T13:30:00Z", "America/New_York")).toContain("9:30");
  });
});

const today = new Date("2026-10-29T15:00:00Z");

describe("quiet partner detection", () => {
  it("is unknown when nothing is visible", () => {
    expect(daysSinceLastCheckIn([], today)).toBeNull();
    expect(isQuiet({ recent: [] }, today)).toBe(false);
    expect(isQuiet(null, today)).toBe(false);
  });
  it("uses the latest visible check-in regardless of order", () => {
    expect(daysSinceLastCheckIn([{ day: "2026-10-20" }, { day: "2026-10-27" }, { day: "2026-10-22" }], today)).toBe(2);
  });
  it("flags 4 or more days", () => {
    expect(isQuiet({ recent: [{ day: "2026-10-26" }] as never }, today)).toBe(false);
    expect(isQuiet({ recent: [{ day: "2026-10-25" }] as never }, today)).toBe(true);
  });
  it("never goes negative for a future day", () => {
    expect(daysSinceLastCheckIn([{ day: "2026-10-30" }], today)).toBe(0);
  });
});

describe("meetup ics", () => {
  const ics = meetupIcs({
    id: "abc",
    title: "Sunday check-in; week 3, all",
    startsAt: "2026-11-01T18:00:00Z",
    durationMin: 45,
    link: "https://meet.example.com/x",
    circleName: "Runners",
    circleUrl: "https://goalkin.app/app/circles/1",
    now: new Date("2026-10-29T00:00:00Z"),
  });
  it("has start and end in UTC", () => {
    expect(ics).toContain("DTSTART:20261101T180000Z");
    expect(ics).toContain("DTEND:20261101T184500Z");
    expect(ics).toContain("UID:meetup-abc@goalkin.app");
  });
  it("escapes text and uses CRLF", () => {
    expect(ics).toContain("SUMMARY:Sunday check-in\\; week 3\\, all");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("folds long lines to 75 octets", () => {
    const folded = icsFold("DESCRIPTION:" + "x".repeat(200));
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe("DESCRIPTION:" + "x".repeat(200));
  });
  it("escapes newlines and backslashes", () => {
    expect(icsEscape("a\\b\nc")).toBe("a\\\\b\\nc");
  });
  it("makes a safe filename", () => {
    expect(icsFilename("Sunday check-in!")).toBe("sunday-check-in.ics");
    expect(icsFilename("!!!")).toBe("meetup.ics");
  });
});

describe("invite helpers", () => {
  it("validates tokens and codes", () => {
    expect(isInviteToken("a".repeat(32))).toBe(true);
    expect(isInviteToken("A".repeat(32))).toBe(false);
    expect(isInviteToken("a".repeat(31))).toBe(false);
    expect(isCircleCode("0123456789abcdef01")).toBe(true);
    expect(isCircleCode("../etc")).toBe(false);
    expect(isRoomCode("0123456789ab")).toBe(true);
  });
  it("reads a circle preview", () => {
    const p = readInvitePreview(circleInvitePreview({ circleName: "Runners", leaderName: "Sam" }));
    expect(p.type).toBe("circle");
  });
  it("reads a goal preview stored directly or wrapped", () => {
    const view = { title: "Run a 10K", status: "on_track", percent: 40, fields: [], recent: [], hidden_count: 3 };
    expect(readInvitePreview(view)).toMatchObject({ type: "goal", view: { title: "Run a 10K", percent: 40 } });
    expect(readInvitePreview({ kind: "goal", ring: "chosen", view })).toMatchObject({ type: "goal", ring: "chosen" });
  });
  it("treats unknown previews as unknown", () => {
    expect(readInvitePreview({}).type).toBe("unknown");
    expect(readInvitePreview(null).type).toBe("unknown");
  });
  it("labels reactions with words", () => {
    expect(reactionBody(0)).toBe("👏 Applause");
    expect(reactionBody(99)).toBeNull();
  });
  it("only accepts voice paths in the sender's folder shape", () => {
    const uid = "11111111-2222-3333-4444-555555555555";
    expect(voicePathOwner(`${uid}/voice/${uid}.webm`)).toBe(uid);
    expect(voicePathOwner(`${uid}/photos/${uid}.webm`)).toBeNull();
    expect(voicePathOwner(`../${uid}/voice/${uid}.webm`)).toBeNull();
  });
});
