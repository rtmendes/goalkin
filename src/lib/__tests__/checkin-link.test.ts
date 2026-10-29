import { describe, expect, it } from "vitest";
import { checkinDayAllowed, checkinUrl, signCheckinLink, verifyCheckinLink } from "@/lib/checkin-link";

const KEY = "test-secret";

describe("check-in links", () => {
  it("signs deterministically and verifies", () => {
    const t = signCheckinLink("g1", "u1", "2026-10-29", KEY);
    expect(t).toMatch(/^[a-f0-9]{64}$/);
    expect(signCheckinLink("g1", "u1", "2026-10-29", KEY)).toBe(t);
    expect(verifyCheckinLink("g1", "u1", "2026-10-29", t, KEY)).toBe(true);
  });
  it("rejects a token for another day, goal, person or key", () => {
    const t = signCheckinLink("g1", "u1", "2026-10-29", KEY);
    expect(verifyCheckinLink("g1", "u1", "2026-10-30", t, KEY)).toBe(false);
    expect(verifyCheckinLink("g2", "u1", "2026-10-29", t, KEY)).toBe(false);
    expect(verifyCheckinLink("g1", "u2", "2026-10-29", t, KEY)).toBe(false);
    expect(verifyCheckinLink("g1", "u1", "2026-10-29", t, "other")).toBe(false);
  });
  it("rejects malformed tokens and a missing secret", () => {
    expect(verifyCheckinLink("g1", "u1", "2026-10-29", "nope", KEY)).toBe(false);
    expect(verifyCheckinLink("g1", "u1", "2026-10-29", "a".repeat(64), "")).toBe(false);
    expect(() => signCheckinLink("g1", "u1", "2026-10-29", "")).toThrow();
  });
  it("builds a URL from the env secret", () => {
    process.env.CHECKIN_LINK_SECRET = KEY;
    const url = new URL(checkinUrl("g1", "u1", "2026-10-29", "done", "https://goalkin.app/"));
    expect(url.pathname).toBe("/api/checkin");
    expect(url.searchParams.get("s")).toBe("done");
    expect(verifyCheckinLink("g1", "u1", "2026-10-29", url.searchParams.get("t")!)).toBe(true);
    delete process.env.CHECKIN_LINK_SECRET;
  });
  it("only accepts recent days", () => {
    expect(checkinDayAllowed("2026-10-29", "2026-10-29")).toBe(true);
    expect(checkinDayAllowed("2026-10-30", "2026-10-29")).toBe(true);
    expect(checkinDayAllowed("2026-10-31", "2026-10-29")).toBe(false);
    expect(checkinDayAllowed("2026-10-01", "2026-10-29")).toBe(false);
    expect(checkinDayAllowed("2026-13-40", "2026-10-29")).toBe(false);
  });
});
