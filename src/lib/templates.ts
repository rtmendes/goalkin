import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import type { TemplateBody } from "@/lib/types";

export interface CatalogEntry {
  id: string;
  area: string;
  name: string;
  onboarding_inputs: string[];
  ai_builds: string;
  tracks: string[];
  default_visibility: string;
  tier: "Free" | "Premium" | "Creator";
}

export interface Listing {
  id: string;
  name: string;
  area: string;
  tier: string;
  price: number;
  summary: string;
  duration: string | null;
  creator_id: string | null;
  checkout_url: string | null;
  hasFullTemplate: boolean;
}

const ROOT = process.cwd();

export async function readCatalog(): Promise<CatalogEntry[]> {
  const raw = await fs.readFile(path.join(ROOT, "templates/catalog.json"), "utf8");
  return JSON.parse(raw).templates;
}

export async function readFullTemplate(id: string): Promise<TemplateBody | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, "templates/full", `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

/** Published templates from the database, falling back to the repo files so the app works before seeding. */
export async function listTemplates(): Promise<Listing[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("gk_templates")
      .select("id,name,area,tier,price,summary,duration,creator_id,checkout_url")
      .eq("status", "published")
      .order("area");
    if (!error && data && data.length) return data.map((d) => ({ ...d, price: Number(d.price), hasFullTemplate: true }));
  } catch {
    /* fall through */
  }
  const catalog = await readCatalog();
  return Promise.all(
    catalog.map(async (c) => {
      const full = await readFullTemplate(c.id);
      return {
        id: c.id, name: c.name, area: c.area, tier: c.tier,
        price: full?.price ?? 0,
        summary: full?.summary ?? c.ai_builds,
        duration: full?.duration ?? null,
        creator_id: null, checkout_url: null,
        hasFullTemplate: !!full,
      };
    }),
  );
}

export async function getTemplate(id: string): Promise<{ body: TemplateBody; listing: Listing } | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("gk_templates").select("*").eq("id", id).maybeSingle();
    if (data) return { body: data.body as TemplateBody, listing: { ...data, price: Number(data.price), hasFullTemplate: true } };
  } catch {
    /* fall through */
  }
  const body = await readFullTemplate(id);
  if (!body) return null;
  return {
    body,
    listing: { id: body.id, name: body.name, area: body.area, tier: body.tier, price: body.price ?? 0, summary: body.summary, duration: body.duration ?? null, creator_id: null, checkout_url: null, hasFullTemplate: true },
  };
}
