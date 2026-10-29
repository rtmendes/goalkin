export type Visibility = "private" | "chosen" | "circle" | "public";
export type Tone = "gentle" | "coach" | "drill" | "playful";
export type Approach = "habit" | "willpower" | "time" | "reward" | "resource";
export type ApproachWeights = Record<Approach, number>;
export type TrackingMode = "detailed" | "simple" | "reflective";
export type CheckInStatus = "done" | "partly" | "missed";
export type FieldKind = "number" | "yes_no" | "rating" | "note" | "money" | "duration" | "percent" | "photo";
export type PlanTier = "free" | "pro" | "circle" | "club";

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  default_tone: Tone;
  approach: ApproachWeights;
  readiness: Record<string, number>;
  plan: PlanTier;
  plan_until: string | null;
  theme: "system" | "light" | "dark";
  quiet_start: string;
  quiet_end: string;
  onboarded_at: string | null;
}

export interface Goal {
  id: string;
  owner_id: string;
  title: string;
  why: string | null;
  why_media_url: string | null;
  area: string | null;
  template_id: string | null;
  start_date: string;
  finish_date: string | null;
  tracking_mode: TrackingMode;
  tone: Tone;
  approach: ApproachWeights | null;
  answers: Record<string, unknown>;
  readiness: Record<string, number>;
  if_then: { if: string; then: string }[];
  restart_rule: string | null;
  status: "draft" | "active" | "paused" | "finished" | "archived";
  visibility: Visibility;
  circle_id: string | null;
  parent_goal_id: string | null;
  share_token: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface GoalField {
  id: string;
  goal_id: string;
  key: string;
  label: string;
  kind: FieldKind;
  unit: string | null;
  target: number | null;
  visibility: Visibility;
  sort: number;
}

export interface SummaryVisibility {
  goal_id: string;
  status: Visibility;
  percent: Visibility;
  streak: Visibility;
  plan: Visibility;
  why: Visibility;
  check_in_notes: Visibility;
  photos: Visibility;
}

export interface PlanItem {
  id: string;
  goal_id: string;
  week: number;
  due_date: string | null;
  starts_at: string | null;
  duration_min: number | null;
  title: string;
  notes: string | null;
  kind: "action" | "benchmark" | "session" | "checkin" | "guardrail" | "milestone" | "reward" | "gather";
  source: "ai" | "template" | "person";
  required: boolean;
  done: boolean;
  done_at: string | null;
  gcal_event_id: string | null;
  sort: number;
}

export interface CheckIn {
  id: string;
  goal_id: string;
  user_id: string;
  day: string;
  status: CheckInStatus;
  rating: number | null;
  note: string | null;
  photo_url: string | null;
  values: Record<string, number>;
  created_at: string;
}

export interface Circle {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  kind: "pair" | "group" | "club";
  tone: Tone;
  program: string | null;
  invite_code: string;
  max_members: number;
  shared_goal_id: string | null;
  created_at: string;
}

/** Template file format, see templates/schema.json. */
export interface TemplateQuestion {
  id: string;
  prompt: string;
  type: "text" | "number" | "slider" | "choice" | "multi_choice" | "date" | "calendar_slots";
  options?: string[];
  min?: number;
  max?: number;
  reaction?: string;
  optional?: boolean;
}

export interface TemplateBody {
  id: string;
  name: string;
  area: string;
  tier: "Free" | "Premium" | "Creator" | "Custom";
  price?: number | null;
  summary: string;
  duration?: string;
  onboarding: TemplateQuestion[];
  plan_blueprint: {
    phases: { name: string; weeks: string; benchmarks?: string[]; actions?: string[] }[];
    calendar?: string;
  };
  approach_variants?: Partial<Record<Approach, string>>;
  tracked_fields: { id: string; label: string; kind: FieldKind; unit?: string; default_visibility: Visibility }[];
  guardrails: string[];
  restart_rules?: string;
  addon_tracks?: string[];
  creator?: { id?: string; revenue_share?: number; license?: string };
  price_log?: { from: unknown; to: unknown; basis: string; date: string }[];
}
