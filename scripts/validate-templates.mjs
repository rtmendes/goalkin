#!/usr/bin/env node
// Validate every templates/full/*.json against templates/schema.json plus GoalKin policy rules.
// Zero dependencies (Node 22). Usage: node scripts/validate-templates.mjs [repoRoot]
// Exits 1 on any failure.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const fullDir = path.join(root, "templates", "full");
const schema = JSON.parse(fs.readFileSync(path.join(root, "templates", "schema.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(root, "templates", "catalog.json"), "utf8"));

const DOCTOR_LINE = "Talk to your doctor before starting. GoalKin offers education, not medical advice.";
const FINANCE_LINE = "This plan is general education, not financial advice. Check big decisions with a qualified professional.";

// Words that make a health-type goal even outside the Health area (diet, supplements, weight).
const HEALTH_CONTENT = /\b(diet|dietary|supplements?|weight loss|calories?|fasting)\b/i;

// Claims we never make anywhere in a template.
const BANNED = [
  [/\bguarantee(d|s)?\b/i, "guarantee"],
  [/\bcure[sd]?\b/i, "cure"],
  [/\blose\s+\d+(\.\d+)?\s*(lbs?|pounds|kgs?|kilos?)\b/i, "lose N lbs/kg"],
  [/\bget rich\b/i, "get rich"],
  [/\bpassive income\b/i, "passive income"],
  [/\brisk[- ]free\b/i, "risk-free"],
  [/\bmiracle\b/i, "miracle"],
  [/\bproven results?\b/i, "proven results"],
  [/\b(earn|make)\s+\$?\d[\d,]*(k)?\s*(a|per)\s*(day|week|month|year)\b/i, "income claim"]
];

// Tracked fields that must stay Private by default: money, weight, body, health metrics, debt, income, balances.
const SENSITIVE_FIELD = /\b(weight|weigh[- ]?ins?|waist|body|bmi|blood|heart|pulse|pressure|glucose|sugar|cholesterol|cravings?|symptoms?|medication|pace|bedtime|wake|rested|sleep|balance|debt|income|salary|pay|spent|saved|savings|amount|raised|money|net worth)\b/i;

const VIS = { P: "private", C: "chosen", Ci: "circle", Pub: "public" };
const WEEKS = /^(\d+)(?:-(\d+))?$/;

// ---------- tiny JSON-schema subset validator (type, enum, required, pattern, minimum, items, properties) ----------
function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}
function typeMatches(v, t) {
  const actual = typeOf(v);
  if (t === "number") return actual === "number" || actual === "integer";
  return actual === t;
}
function checkSchema(v, s, p, errs) {
  if (!s || Object.keys(s).length === 0) return;
  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some((t) => typeMatches(v, t))) { errs.push(`${p}: expected ${types.join("|")}, got ${typeOf(v)}`); return; }
  }
  if (s.enum && !s.enum.includes(v)) errs.push(`${p}: ${JSON.stringify(v)} not in [${s.enum.join(", ")}]`);
  if (s.pattern && typeof v === "string" && !new RegExp(s.pattern).test(v)) errs.push(`${p}: "${v}" does not match ${s.pattern}`);
  if (s.minimum !== undefined && typeof v === "number" && v < s.minimum) errs.push(`${p}: ${v} < minimum ${s.minimum}`);
  if (typeOf(v) === "object") {
    for (const r of s.required ?? []) if (!(r in v)) errs.push(`${p}: missing required "${r}"`);
    for (const [k, sub] of Object.entries(s.properties ?? {})) if (k in v) checkSchema(v[k], sub, `${p}.${k}`, errs);
  }
  if (typeOf(v) === "array" && s.items) v.forEach((x, i) => checkSchema(x, s.items, `${p}[${i}]`, errs));
}

// ---------- helpers ----------
function allStrings(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => allStrings(x, out));
  return out;
}

function policy(t, file, errs) {
  const base = path.basename(file, ".json");
  if (t.id !== base) errs.push(`id "${t.id}" does not match file name "${base}.json"`);

  const cat = [...catalog.templates, ...(catalog.programs ?? [])].find((c) => c.id === t.id);
  if (!cat) errs.push(`id "${t.id}" is not in templates/catalog.json`);
  else {
    if (String(t.name).toLowerCase() !== String(cat.name).toLowerCase()) errs.push(`name "${t.name}" differs from catalog "${cat.name}"`);
    for (const k of ["area", "tier"]) if (t[k] !== cat[k]) errs.push(`${k} "${t[k]}" differs from catalog "${cat[k]}"`);
  }

  // Pricing
  if (t.tier === "Free" && t.price !== 0) errs.push(`Free tier must have price 0`);
  if ((t.tier === "Premium" || t.tier === "Creator") && !(typeof t.price === "number" && t.price >= 9 && t.price <= 37)) errs.push(`${t.tier} price must be in $9-$37 (got ${t.price})`);
  if (!Array.isArray(t.price_log) || t.price_log.length === 0) errs.push(`price_log needs at least one entry`);
  else {
    const last = t.price_log[t.price_log.length - 1];
    if (last.to !== t.price) errs.push(`latest price_log.to (${last.to}) != price (${t.price})`);
    t.price_log.forEach((e, i) => {
      if (!e.basis) errs.push(`price_log[${i}] missing basis`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? "")) errs.push(`price_log[${i}] date must be YYYY-MM-DD`);
    });
  }
  if (t.tier === "Creator") {
    const c = t.creator;
    if (!c || !c.id || typeof c.revenue_share !== "number" || !c.license) errs.push(`Creator tier needs creator {id, revenue_share, license}`);
    else if (c.revenue_share <= 0 || c.revenue_share >= 1) errs.push(`creator.revenue_share must be between 0 and 1`);
  }

  // Text fields
  for (const k of ["summary", "duration", "restart_rules"]) if (!t[k] || !String(t[k]).trim()) errs.push(`${k} is empty`);

  // Onboarding
  const ob = t.onboarding ?? [];
  if (ob.length < 3 || ob.length > 7) errs.push(`onboarding should have 3-7 questions (has ${ob.length})`);
  if (!ob.some((q) => q.type === "calendar_slots")) errs.push(`onboarding needs a calendar_slots question`);
  const qids = new Set();
  ob.forEach((q, i) => {
    if (qids.has(q.id)) errs.push(`onboarding[${i}] duplicate id "${q.id}"`);
    qids.add(q.id);
    if ((q.type === "choice" || q.type === "multi_choice") && !(Array.isArray(q.options) && q.options.length >= 2)) errs.push(`onboarding[${i}] ${q.type} needs 2+ options`);
    if (q.type === "slider" && !(typeof q.min === "number" && typeof q.max === "number" && q.min < q.max)) errs.push(`onboarding[${i}] slider needs min < max`);
  });

  // Plan blueprint
  const phases = t.plan_blueprint?.phases ?? [];
  if (phases.length === 0) errs.push(`plan_blueprint.phases is empty`);
  phases.forEach((ph, i) => {
    const m = WEEKS.exec(ph.weeks ?? "");
    if (!m) errs.push(`phases[${i}].weeks "${ph.weeks}" must be "N" or "N-M"`);
    else if (m[2] && Number(m[2]) < Number(m[1])) errs.push(`phases[${i}].weeks "${ph.weeks}" ends before it starts`);
    else if (Number(m[1]) < 1) errs.push(`phases[${i}].weeks must start at 1 or later`);
  });
  if (!t.plan_blueprint?.calendar) errs.push(`plan_blueprint.calendar is missing`);

  // Approach variants
  for (const a of ["habit", "willpower", "time", "reward", "resource"]) if (!t.approach_variants?.[a]) errs.push(`approach_variants.${a} is missing`);

  // Tracked fields
  const fids = new Set();
  (t.tracked_fields ?? []).forEach((f, i) => {
    if (fids.has(f.id)) errs.push(`tracked_fields[${i}] duplicate id "${f.id}"`);
    fids.add(f.id);
    const sensitive = f.kind === "money" || SENSITIVE_FIELD.test(`${f.id.replace(/_/g, " ")} ${f.label}`);
    if (sensitive && f.default_visibility !== "private") errs.push(`tracked_fields[${i}] "${f.label}" is a money/body/health field and must default to private`);
  });
  if ((t.tracked_fields ?? []).length === 0) errs.push(`tracked_fields is empty`);

  // Guardrails
  const g = t.guardrails ?? [];
  const healthy = t.area === "Health" || HEALTH_CONTENT.test(allStrings([t.onboarding, t.plan_blueprint, t.summary]).join("\n"));
  if (healthy && !g.includes(DOCTOR_LINE)) errs.push(`health/diet goal must include guardrail: "${DOCTOR_LINE}"`);
  if (t.area === "Wealth" && !g.includes(FINANCE_LINE)) errs.push(`Wealth goal must include guardrail: "${FINANCE_LINE}"`);

  // Banned claims
  for (const [re, label] of BANNED) {
    const hit = allStrings(t).find((s) => re.test(s));
    if (hit) errs.push(`banned claim (${label}): "${hit.slice(0, 80)}"`);
  }
}

// ---------- run ----------
const files = fs.readdirSync(fullDir).filter((f) => f.endsWith(".json")).sort();
let failed = 0;
const results = [];
for (const f of files) {
  const errs = [];
  let t;
  try { t = JSON.parse(fs.readFileSync(path.join(fullDir, f), "utf8")); }
  catch (e) { errs.push(`invalid JSON: ${e.message}`); }
  if (t) { checkSchema(t, schema, "$", errs); policy(t, f, errs); }
  results.push({ f, errs });
  if (errs.length) failed++;
}

// Catalog coverage
const have = new Set(files.map((f) => path.basename(f, ".json")));
const missing = catalog.templates.map((c) => c.id).filter((id) => !have.has(id));
// Sanity-check the catalog visibility codes are all known.
const badCodes = [];
for (const c of catalog.templates) {
  for (const code of (c.default_visibility.match(/\b(Pub|Ci|C|P)\b/g) ?? [])) if (!VIS[code]) badCodes.push(`${c.id}:${code}`);
}

for (const { f, errs } of results) {
  if (errs.length) {
    console.log(`FAIL ${f}`);
    for (const e of errs) console.log(`  - ${e}`);
  } else console.log(`ok   ${f}`);
}
if (missing.length) console.log(`\nMissing template files for catalog ids: ${missing.join(", ")}`);
if (badCodes.length) console.log(`\nUnknown visibility codes in catalog: ${badCodes.join(", ")}`);

const passed = files.length - failed;
console.log(`\nSummary: ${passed}/${files.length} files pass; catalog has ${catalog.templates.length} ids, ${missing.length} missing.`);
process.exit(failed || missing.length || badCodes.length ? 1 : 0);
