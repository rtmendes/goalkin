import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/** Vercel cron convention: `Authorization: Bearer ${CRON_SECRET}`. Fails closed without a secret. */
export function cronAuthorized(req: Request): boolean {
  const secret = serverEnv().cronSecret;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
