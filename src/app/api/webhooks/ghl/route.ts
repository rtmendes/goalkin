import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { parsePurchasePayload } from "@/lib/commerce/payload";
import { recordPurchase } from "@/lib/commerce/purchases";

// GoHighLevel purchase webhook. Configure the GHL workflow to POST JSON here with
// header `x-goalkin-secret: <GHL_WEBHOOK_SECRET>`.

function secretMatches(given: string | null, expected: string) {
  // Hash both sides so the comparison is constant-time regardless of length.
  const a = createHash("sha256").update(given ?? "").digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) && !!given;
}

export async function POST(request: NextRequest) {
  const expected = serverEnv().ghlWebhookSecret;
  if (!expected) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  if (!secretMatches(request.headers.get("x-goalkin-secret"), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    const type = request.headers.get("content-type") ?? "";
    body = type.includes("application/x-www-form-urlencoded")
      ? Object.fromEntries(new URLSearchParams(await request.text()))
      : await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = parsePurchasePayload(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await recordPurchase(parsed.purchase, body);
  if (result.status === "error") return NextResponse.json({ error: "Could not record purchase" }, { status: 500 });
  // Unmapped products are stored for follow-up; 202 so GHL does not retry forever.
  return NextResponse.json({ ok: true, ...result }, { status: result.status === "unmapped" ? 202 : 200 });
}
