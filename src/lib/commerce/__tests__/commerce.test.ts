import { describe, expect, it } from "vitest";
import { creatorShare, mapProduct, nextPlanState, templateIdFor } from "@/lib/commerce/products";
import { parseAmount, parsePurchasePayload } from "@/lib/commerce/payload";
import { checkoutHref } from "@/lib/commerce/checkout";

describe("product mapping", () => {
  it("accepts product keys as-is", () => {
    expect(mapProduct("pro_monthly")).toBe("pro_monthly");
    expect(mapProduct("PRO_YEARLY")).toBe("pro_yearly");
    expect(mapProduct("circle")).toBe("circle");
    expect(mapProduct("club")).toBe("club");
    expect(mapProduct("template:debt-payoff")).toBe("template:debt-payoff");
    expect(mapProduct("program:finish-the-year")).toBe("program:finish-the-year");
  });
  it("maps GHL product and price names", () => {
    expect(mapProduct("GoalKin Pro - Monthly")).toBe("pro_monthly");
    expect(mapProduct("GoalKin Pro (Annual)")).toBe("pro_yearly");
    expect(mapProduct("Pro yearly plan")).toBe("pro_yearly");
    expect(mapProduct("GoalKin Circle")).toBe("circle");
    expect(mapProduct("Club plan")).toBe("club");
    expect(mapProduct("Finish the Year Program")).toBe("program:finish-the-year");
    expect(mapProduct("Finish 2026 challenge")).toBe("program:finish-the-year");
    expect(mapProduct("New Year Reset")).toBe("program:new-year-reset");
    expect(mapProduct("Template: debt-payoff")).toBe("template:debt-payoff");
  });
  it("does not confuse 'program' with 'pro' and rejects unknowns", () => {
    expect(mapProduct("Some program")).toBeNull();
    expect(mapProduct("Mystery box")).toBeNull();
    expect(mapProduct("")).toBeNull();
    expect(mapProduct(undefined)).toBeNull();
    expect(mapProduct("template:../etc")).toBeNull();
  });
  it("finds the template a purchase unlocks", () => {
    expect(templateIdFor("template:debt-payoff")).toBe("debt-payoff");
    expect(templateIdFor("program:new-year-reset")).toBe("new-year-reset");
    expect(templateIdFor("pro_monthly")).toBeNull();
  });
});

describe("plan state after purchase", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  it("starts a new plan from now", () => {
    expect(nextPlanState({ plan: "free", plan_until: null }, "pro_monthly", now)).toEqual({ plan: "pro", plan_until: "2026-12-01T00:00:00.000Z" });
    expect(nextPlanState(null, "pro_yearly", now)).toEqual({ plan: "pro", plan_until: "2027-11-01T00:00:00.000Z" });
  });
  it("stacks time on an active plan of the same tier", () => {
    expect(nextPlanState({ plan: "pro", plan_until: "2026-11-15T00:00:00Z" }, "pro_monthly", now)?.plan_until).toBe("2026-12-15T00:00:00.000Z");
  });
  it("restarts from now when the old plan expired", () => {
    expect(nextPlanState({ plan: "pro", plan_until: "2026-10-01T00:00:00Z" }, "pro_monthly", now)?.plan_until).toBe("2026-12-01T00:00:00.000Z");
  });
  it("never downgrades an active higher tier", () => {
    expect(nextPlanState({ plan: "club", plan_until: "2026-12-01T00:00:00Z" }, "pro_monthly", now)).toBeNull();
  });
  it("upgrades from a lower tier", () => {
    expect(nextPlanState({ plan: "pro", plan_until: "2026-12-01T00:00:00Z" }, "circle", now)).toEqual({ plan: "circle", plan_until: "2026-12-01T00:00:00.000Z" });
  });
});

describe("creator share", () => {
  it("rounds to cents", () => {
    expect(creatorShare(37, 0.7)).toBe(25.9);
    expect(creatorShare(9.99, 0.7)).toBe(6.99);
    expect(creatorShare(null, 0.7)).toBeNull();
  });
});

describe("webhook payload parsing", () => {
  it("reads a flat payload", () => {
    const r = parsePurchasePayload({ email: "Maya@Example.com", product: "pro_yearly", amount: "79.00", order_id: "ord_1" });
    expect(r).toEqual({ ok: true, purchase: { email: "maya@example.com", product: "pro_yearly", productName: "pro_yearly", amount: 79, currency: "USD", providerRef: "ord_1" } });
  });
  it("reads a nested GHL order payload", () => {
    const r = parsePurchasePayload({
      contact: { email: "jr@example.com" },
      order: { id: "6720abc", currency: "usd", total: 37, line_items: [{ name: "Finish the Year Program", price: 37 }] },
    });
    expect(r.ok && r.purchase).toMatchObject({ email: "jr@example.com", product: "program:finish-the-year", amount: 37, currency: "USD", providerRef: "6720abc" });
  });
  it("prefers an explicit product key over the display name", () => {
    const r = parsePurchasePayload({ email: "a@b.co", product_key: "template:debt-payoff", product_name: "Debt payoff plan", transactionId: "t9", amount: "$19" });
    expect(r.ok && r.purchase).toMatchObject({ product: "template:debt-payoff", amount: 19, providerRef: "t9" });
  });
  it("keeps unknown products for follow-up", () => {
    const r = parsePurchasePayload({ email: "a@b.co", product_name: "Mystery box", order_id: "x" });
    expect(r.ok && r.purchase.product).toBeNull();
    expect(r.ok && r.purchase.productName).toBe("Mystery box");
  });
  it("rejects bad payloads", () => {
    expect(parsePurchasePayload(null).ok).toBe(false);
    expect(parsePurchasePayload([1, 2]).ok).toBe(false);
    expect(parsePurchasePayload({ email: "not-an-email", product: "pro_monthly", order_id: "1" }).ok).toBe(false);
    expect(parsePurchasePayload({ email: "a@b.co", product: "pro_monthly" }).ok).toBe(false);
    expect(parsePurchasePayload({ email: "a@b.co", order_id: "1" }).ok).toBe(false);
  });
  it("parses amounts", () => {
    expect(parseAmount("$1,037.50")).toBe(1037.5);
    expect(parseAmount(9)).toBe(9);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(-1)).toBeNull();
  });
});

describe("checkout links", () => {
  it("appends the email safely", () => {
    expect(checkoutHref("https://pay.example.com/order?x=1", "a+b@c.co")).toBe("https://pay.example.com/order?x=1&email=a%2Bb%40c.co");
    expect(checkoutHref("https://pay.example.com/order", null)).toBe("https://pay.example.com/order");
  });
  it("never returns a dead or unsafe link", () => {
    expect(checkoutHref("", "a@b.co")).toBeNull();
    expect(checkoutHref("not a url")).toBeNull();
    expect(checkoutHref("javascript:alert(1)")).toBeNull();
  });
});
