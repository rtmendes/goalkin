// Pure helpers that turn templates into what a goal needs: onboarding questions,
// tracked fields with safe default visibility, and a template body for catalog
// entries that do not have a full JSON file yet.

import type { FieldKind, TemplateBody, TemplateQuestion, Visibility } from "@/lib/types";

export interface CatalogLike {
  id: string;
  area: string;
  name: string;
  onboarding_inputs: string[];
  ai_builds: string;
  tracks: string[];
  default_visibility: string;
  tier: "Free" | "Premium" | "Creator";
}

export const slugKey = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "field";

const SENSITIVE = /weight|weigh-?in|bmi|body fat|waist|blood|glucose|calori|medic|symptom|sleep apnea|debt|income|salary|savings|saved|net worth|spend|budget|money|dollar|\$|paid|balance|credit/i;

/** Health, money and weight numbers start private no matter what the template says. */
export function isSensitiveField(f: { label: string; kind: FieldKind | string }) {
  return f.kind === "money" || SENSITIVE.test(f.label);
}

export function safeDefaultVisibility(f: { label: string; kind: FieldKind | string; default_visibility: Visibility }): Visibility {
  return isSensitiveField(f) ? "private" : f.default_visibility;
}

export interface FieldDraft {
  key: string;
  label: string;
  kind: FieldKind;
  unit: string | null;
  target: number | null;
  visibility: Visibility;
  sort: number;
}

export function fieldsFromTemplate(body: Pick<TemplateBody, "tracked_fields"> | null): FieldDraft[] {
  const seen = new Set<string>();
  return (body?.tracked_fields ?? []).map((f, i) => {
    let key = slugKey(f.id || f.label);
    while (seen.has(key)) key = `${key}_${i}`;
    seen.add(key);
    return { key, label: f.label, kind: f.kind, unit: f.unit ?? null, target: null, visibility: safeDefaultVisibility(f), sort: i };
  });
}

const VIS_CODES: Record<string, Visibility> = { p: "private", c: "chosen", ci: "circle", pub: "public" };

/** Parse catalog strings like "Distance Ci; pace P" or "All C" into a ring for one tracked label. */
export function visibilityFor(label: string, spec: string): Visibility {
  const parts = spec.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  let all: Visibility | null = null;
  for (const part of parts) {
    const m = part.match(/^(.*?)\s+(P|C|Ci|Pub)$/i);
    if (!m) continue;
    const ring = VIS_CODES[m[2].toLowerCase()];
    const name = m[1].toLowerCase();
    if (name === "all") all = ring;
    const firstWord = name.split(/\s+/)[0];
    if (firstWord && label.toLowerCase().includes(firstWord)) return ring;
  }
  return all ?? "private";
}

export function guessFieldKind(label: string): FieldKind {
  const l = label.toLowerCase();
  if (/\$|money|saved|raised|paid|debt|income|spend|budget|dollar|net worth/.test(l)) return "money";
  if (/hours|minutes|time spent/.test(l)) return "duration";
  if (/%|percent/.test(l)) return "percent";
  if (/rating|mood|how .* felt|score/.test(l)) return "rating";
  if (/note|reflection|journal|prayer list|wins/.test(l)) return "note";
  if (/photo|picture/.test(l)) return "photo";
  if (/^(did|yes|no)\b|done\?/.test(l)) return "yes_no";
  return "number";
}

export function guessQuestionType(input: string): TemplateQuestion["type"] {
  const l = input.toLowerCase();
  if (/date|deadline|by when|start/.test(l)) return "date";
  if (/days free|days available|time of day|slots?\b|meeting day|when you/.test(l)) return "calendar_slots";
  if (/how many|per week|per day|miles|minutes|hours|amount|\$|number|count|size|target|weekly|monthly|age/.test(l)) return "number";
  return "text";
}

const sentence = (s: string) => {
  const t = s.replace(/"/g, "").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Build a usable template body from a catalog row (used until its full JSON exists). */
export function bodyFromCatalog(c: CatalogLike): TemplateBody {
  return {
    id: c.id,
    name: c.name,
    area: c.area,
    tier: c.tier,
    price: 0,
    summary: c.ai_builds,
    onboarding: c.onboarding_inputs.map((input, i) => {
      const type = guessQuestionType(input);
      return {
        id: slugKey(input) || `q${i}`,
        prompt: type === "calendar_slots" ? `${sentence(input)}: tap your open slots.` : `${sentence(input)}?`,
        type,
        optional: true,
        ...(type === "number" ? { min: 0 } : {}),
      };
    }),
    plan_blueprint: { phases: [] },
    tracked_fields: c.tracks.map((label) => {
      const kind = guessFieldKind(label);
      return { id: slugKey(label), label: sentence(label), kind, default_visibility: visibilityFor(label, c.default_visibility) };
    }),
    guardrails: [],
  };
}
