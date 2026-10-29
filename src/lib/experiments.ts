import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type Variant = { key: string; weight: number; config?: Record<string, unknown> };

/** Stable bucket in [0,100) for a person and experiment. */
export function bucket(experimentId: string, userId: string): number {
  const h = createHash("sha256").update(`${experimentId}:${userId}`).digest();
  return h.readUInt32BE(0) % 100;
}

export function pickVariant(variants: Variant[], b: number): Variant {
  const total = variants.reduce((s, v) => s + v.weight, 0) || 1;
  let acc = 0;
  for (const v of variants) {
    acc += (v.weight / total) * 100;
    if (b < acc) return v;
  }
  return variants[variants.length - 1];
}

/** Assign (once) and return the variant; falls back to the first variant if the DB is unavailable. */
export async function variantFor(experimentId: string, userId: string): Promise<{ key: string; config: Record<string, unknown> }> {
  try {
    const db = createAdminClient();
    const { data: exp } = await db.from("gk_experiments").select("variants, active").eq("id", experimentId).maybeSingle();
    if (!exp) return { key: "control", config: {} };
    const variants = exp.variants as Variant[];
    const { data: existing } = await db.from("gk_experiment_assignments").select("variant").eq("experiment_id", experimentId).eq("user_id", userId).maybeSingle();
    const key = existing?.variant ?? (exp.active ? pickVariant(variants, bucket(experimentId, userId)).key : variants[0].key);
    if (!existing) await db.from("gk_experiment_assignments").insert({ experiment_id: experimentId, user_id: userId, variant: key });
    return { key, config: variants.find((v) => v.key === key)?.config ?? {} };
  } catch {
    return { key: "control", config: {} };
  }
}

export async function track(userId: string | null, name: string, props: Record<string, unknown> = {}) {
  try {
    await createAdminClient().from("gk_events").insert({ user_id: userId, name, props });
  } catch {
    /* metrics must never break the product */
  }
}
