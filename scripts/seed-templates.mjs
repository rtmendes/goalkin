#!/usr/bin/env node
// Seed gk_templates from templates/catalog.json + templates/full/*.json.
// Zero dependencies: secrets come from Infisical (scripts/secrets.mjs), writes go
// through Supabase REST with the service role key.
//
//   node scripts/seed-templates.mjs          upsert all templates as published
//   node scripts/seed-templates.mjs --dry    print what would be written
//
// A full template file wins. Otherwise a minimal, schema-valid body is built from
// the catalog entry, with Health/Wealth guardrails and every field Private.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSecrets } from "./secrets.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

// Same wording as src/lib/plan.ts so guardrails match what the app adds.
const DOCTOR_STEP = "Talk to your doctor before starting. GoalKin offers education, not medical advice.";
const MONEY_NOTICE = "This plan is general education, not financial advice. Check big decisions with a qualified professional.";
// Placeholder list prices for paid catalog entries without a full file (owner to confirm; see docs/DECISIONS.md #8).
const DEFAULT_PRICE = { Free: 0, Premium: 19, Creator: 9 };
const REQUIRED = ["id", "name", "area", "tier", "summary", "onboarding", "plan_blueprint", "tracked_fields", "guardrails"];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "field";

function fieldKind(label) {
  if (/\$|money|saved|debt|income|spent|paid|budget|balance|given|donat/i.test(label)) return "money";
  if (/minute|hour|time spent|duration/i.test(label)) return "duration";
  if (/%|percent/i.test(label)) return "percent";
  if (/rating|mood|energy|score/i.test(label)) return "rating";
  if (/note|reflection|journal|prayer/i.test(label)) return "note";
  if (/miles|km|distance|weight|count|runs|pages|chapters|steps|sessions|days|books|reps|workouts|calls|hours|number|streak|done/i.test(label)) return "number";
  return "yes_no";
}

function guardrailsFor(area, existing = []) {
  const out = new Set(existing);
  if (area === "Health" && ![...out].some((g) => /doctor|clinician/i.test(g))) out.add(DOCTOR_STEP);
  if (area === "Wealth" && ![...out].some((g) => /financial advice/i.test(g))) out.add(MONEY_NOTICE);
  return [...out];
}

function minimalBody(entry, version) {
  const price = DEFAULT_PRICE[entry.tier] ?? 0;
  const seen = new Set();
  const uniq = (id) => {
    let k = id;
    for (let i = 2; seen.has(k); i++) k = `${id}_${i}`;
    seen.add(k);
    return k;
  };
  return {
    id: entry.id,
    name: entry.name,
    area: entry.area,
    tier: entry.tier,
    price,
    summary: entry.ai_builds,
    onboarding: entry.onboarding_inputs.map((q) => ({ id: uniq(slug(q)), prompt: q.charAt(0).toUpperCase() + q.slice(1), type: "text", optional: true })),
    plan_blueprint: {
      phases: [
        { name: "Get going", weeks: "1-2", benchmarks: ["Do the first action three times"], actions: ["Do the smallest useful version of the work"] },
        { name: "Build", weeks: "3-8", benchmarks: ["Hit your weekly target most weeks"], actions: ["Weekly work session", "Note what moved you forward"] },
        { name: "Finish", weeks: "9-10", benchmarks: ["Reach the goal"], actions: ["Final push", "Celebrate and reflect"] },
      ],
    },
    // Private by default; the person widens each field themselves.
    tracked_fields: entry.tracks.map((t) => ({ id: uniq(slug(t)), label: t, kind: fieldKind(t), default_visibility: "private" })),
    guardrails: guardrailsFor(entry.area),
    restart_rules: "Missed a few days? Restart small: half-size actions for a week, nothing lost.",
    price_log: [{ from: null, to: price, basis: "Seeded from templates/catalog.json; placeholder until the full template is written", date: version }],
  };
}

function validate(body) {
  const missing = REQUIRED.filter((k) => body[k] === undefined || body[k] === null);
  if (missing.length) throw new Error(`${body.id}: missing ${missing.join(", ")}`);
  if (!/^[a-z0-9-]+$/.test(body.id)) throw new Error(`${body.id}: bad id`);
  if (!Array.isArray(body.plan_blueprint?.phases) || !body.plan_blueprint.phases.length) throw new Error(`${body.id}: no phases`);
}

async function readFull(id) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, "templates/full", `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const catalog = JSON.parse(await fs.readFile(path.join(ROOT, "templates/catalog.json"), "utf8"));
  const fullFiles = (await fs.readdir(path.join(ROOT, "templates/full")).catch(() => [])).filter((f) => f.endsWith(".json"));
  const ids = new Set([...catalog.templates.map((t) => t.id), ...fullFiles.map((f) => f.replace(/\.json$/, ""))]);

  const rows = [];
  for (const id of ids) {
    const entry = catalog.templates.find((t) => t.id === id);
    const full = await readFull(id);
    const body = full ? { ...full, guardrails: guardrailsFor(full.area, full.guardrails) } : minimalBody(entry, catalog.version);
    validate(body);
    const price = Number(body.price ?? DEFAULT_PRICE[body.tier] ?? 0);
    rows.push({
      id: body.id, name: body.name, area: body.area, tier: body.tier, price,
      summary: body.summary ?? "", duration: body.duration ?? null, body, status: "published",
      // PostgREST bulk upserts need identical keys on every row.
      revenue_share: body.creator?.revenue_share ?? 0.7,
      _source: full ? "full" : "catalog",
    });
  }
  rows.sort((a, b) => a.area.localeCompare(b.area) || a.id.localeCompare(b.id));

  if (DRY) {
    for (const r of rows) console.log(`${r._source.padEnd(7)} ${r.tier.padEnd(8)} $${r.price.toFixed(2).padStart(6)}  ${r.area.padEnd(22)} ${r.id}  (${r.body.guardrails.length} guardrail${r.body.guardrails.length === 1 ? "" : "s"}, ${r.body.tracked_fields.length} fields)`);
    console.log(`\n[dry run] would upsert ${rows.length} templates into gk_templates (status=published). ${rows.filter((r) => r._source === "full").length} from full files.`);
    return;
  }

  await loadSecrets({ envFile: path.join(ROOT, ".env.local") });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (Infisical or .env.local).");

  const payload = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "_source")));
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/gk_templates?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Supabase upsert failed: ${res.status} ${await res.text()}`);
  console.log(`Upserted ${payload.length} templates into gk_templates.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
