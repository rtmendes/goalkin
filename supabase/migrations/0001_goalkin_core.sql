-- GoalKin core schema.
-- The Supabase instance is shared with other apps, so every object is prefixed gk_.
-- Privacy model: raw goal data is owner-only under RLS. Anything another person sees
-- (chosen people, circle, public share pages) is served by server code that filters
-- per field through src/lib/visibility.ts. Default visibility is private everywhere.

create extension if not exists pgcrypto;

-- Visibility rings, narrowest first: private < chosen < circle < public.
do $$ begin
  create type gk_visibility as enum ('private', 'chosen', 'circle', 'public');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gk_tone as enum ('gentle', 'coach', 'drill', 'playful');
exception when duplicate_object then null; end $$;

create or replace function gk_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- People -------------------------------------------------------------------

create table if not exists gk_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/New_York',
  default_tone gk_tone not null default 'coach',
  approach jsonb not null default '{"habit":0.2,"willpower":0.2,"time":0.2,"reward":0.2,"resource":0.2}',
  readiness jsonb not null default '{}',
  plan text not null default 'free' check (plan in ('free','pro','circle','club')),
  plan_until timestamptz,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  quiet_start time not null default '21:00',
  quiet_end time not null default '07:00',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gk_profiles_touch before update on gk_profiles for each row execute function gk_touch_updated_at();

-- Templates and marketplace --------------------------------------------------

create table if not exists gk_templates (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  area text not null,
  tier text not null check (tier in ('Free','Premium','Creator','Custom')),
  price numeric(10,2) not null default 0 check (price >= 0),
  summary text not null default '',
  duration text,
  body jsonb not null,                      -- full template per templates/schema.json
  status text not null default 'draft' check (status in ('draft','in_review','published','rejected','archived')),
  creator_id uuid references auth.users(id) on delete set null,
  revenue_share numeric(4,3) not null default 0.700 check (revenue_share between 0 and 1),
  checkout_url text,                        -- GoHighLevel order form for paid templates
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gk_templates_touch before update on gk_templates for each row execute function gk_touch_updated_at();

create table if not exists gk_creators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  bio text,
  website text,
  payout_email text not null,
  status text not null default 'applied' check (status in ('applied','approved','rejected','paused')),
  terms_accepted_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists gk_template_reviews (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references gk_templates(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  checklist jsonb not null,
  decision text not null check (decision in ('approved','changes_requested','rejected')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists gk_library (
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null references gk_templates(id) on delete cascade,
  source text not null check (source in ('free','purchase','custom','gift')),
  acquired_at timestamptz not null default now(),
  primary key (user_id, template_id)
);

create table if not exists gk_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  product text not null,                    -- 'pro_monthly' | 'pro_yearly' | 'circle' | 'club' | 'template:<id>' | 'program:<id>'
  amount numeric(10,2),
  currency text default 'USD',
  provider text not null default 'ghl',
  provider_ref text not null,
  creator_id uuid references auth.users(id) on delete set null,
  creator_share numeric(10,2),
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

-- Circles ------------------------------------------------------------------

create table if not exists gk_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  kind text not null default 'group' check (kind in ('pair','group','club')),
  tone gk_tone not null default 'coach',
  program text,
  invite_code text not null unique default encode(gen_random_bytes(9), 'hex'),
  max_members int not null default 8,
  created_at timestamptz not null default now()
);

create table if not exists gk_circle_members (
  circle_id uuid not null references gk_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('leader','member')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

-- Goals --------------------------------------------------------------------

create table if not exists gk_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  why text,
  why_media_url text,
  area text,
  template_id text references gk_templates(id) on delete set null,
  start_date date not null default current_date,
  finish_date date,
  tracking_mode text not null default 'simple' check (tracking_mode in ('detailed','simple','reflective')),
  tone gk_tone not null default 'coach',
  approach jsonb,
  answers jsonb not null default '{}',      -- onboarding answers used to build the plan
  readiness jsonb not null default '{}',
  if_then jsonb not null default '[]',      -- [{if, then}]
  restart_rule text,
  status text not null default 'active' check (status in ('draft','active','paused','finished','archived')),
  visibility gk_visibility not null default 'private',  -- widest ring that sees the goal card at all
  circle_id uuid references gk_circles(id) on delete set null,
  parent_goal_id uuid references gk_goals(id) on delete cascade, -- member layer under a circle's shared goal
  share_token text unique,                  -- set only when the owner makes the goal public
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gk_goals_owner on gk_goals(owner_id);
create index if not exists gk_goals_circle on gk_goals(circle_id);
create trigger gk_goals_touch before update on gk_goals for each row execute function gk_touch_updated_at();

alter table gk_circles add column if not exists shared_goal_id uuid references gk_goals(id) on delete set null;

-- Each tracked number or note, with its own visibility switch.
create table if not exists gk_goal_fields (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references gk_goals(id) on delete cascade,
  key text not null,
  label text not null,
  kind text not null check (kind in ('number','yes_no','rating','note','money','duration','percent','photo')),
  unit text,
  target numeric,
  visibility gk_visibility not null default 'private',
  sort int not null default 0,
  unique (goal_id, key)
);

-- Visibility of the derived summary values (status, % complete, streak), also per switch.
create table if not exists gk_goal_summary_visibility (
  goal_id uuid primary key references gk_goals(id) on delete cascade,
  status gk_visibility not null default 'private',
  percent gk_visibility not null default 'private',
  streak gk_visibility not null default 'private',
  plan gk_visibility not null default 'private',
  why gk_visibility not null default 'private',
  check_in_notes gk_visibility not null default 'private',
  photos gk_visibility not null default 'private'
);

create table if not exists gk_goal_viewers (     -- "Chosen people"
  goal_id uuid not null references gk_goals(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (goal_id, viewer_id)
);

create table if not exists gk_plan_items (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references gk_goals(id) on delete cascade,
  week int not null default 1,
  due_date date,
  starts_at timestamptz,
  duration_min int,
  title text not null,
  notes text,
  kind text not null default 'action' check (kind in ('action','benchmark','session','checkin','guardrail','milestone','reward','gather')),
  source text not null default 'ai' check (source in ('ai','template','person')),
  required boolean not null default false,  -- guardrail steps (e.g. talk to your doctor) cannot be deleted, only completed
  done boolean not null default false,
  done_at timestamptz,
  gcal_event_id text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gk_plan_items_goal on gk_plan_items(goal_id, due_date);

create table if not exists gk_check_ins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references gk_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  status text not null check (status in ('done','partly','missed')),
  rating int check (rating between 1 and 5),
  note text,
  photo_url text,
  values jsonb not null default '{}',       -- { field_key: number }
  created_at timestamptz not null default now(),
  unique (goal_id, day)
);

create table if not exists gk_consequences (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references gk_goals(id) on delete cascade,
  set_by uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('self','partner_dare','cause_pledge')),
  description text not null,
  trigger_rule text,
  accepted boolean not null default false,  -- owner must accept a partner dare
  triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists gk_encouragements (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references gk_goals(id) on delete cascade,
  circle_id uuid references gk_circles(id) on delete cascade,
  from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('note','reaction','voice','video')),
  body text,
  media_url text,
  created_at timestamptz not null default now()
);

create table if not exists gk_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  email text,
  goal_id uuid references gk_goals(id) on delete cascade,
  circle_id uuid references gk_circles(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  preview jsonb not null default '{}',      -- exactly what the invitee will see, frozen at send time
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (goal_id is not null or circle_id is not null)
);

create table if not exists gk_meetups (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references gk_circles(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  duration_min int not null default 30,
  link text,
  created_by uuid not null references auth.users(id) on delete cascade
);

-- Reminders and channels ------------------------------------------------------

create table if not exists gk_reminders (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references gk_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email','push','calendar')),
  cadence text not null default 'daily' check (cadence in ('daily','weekdays','weekly')),
  time_of_day time not null default '08:00',
  weekday int check (weekday between 0 and 6),
  active boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists gk_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Tokens live here; users never read this table directly (no select policy).
create table if not exists gk_calendar_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ics_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  google_calendar_id text,
  google_refresh_token text,
  google_access_token text,
  google_token_expires timestamptz,
  watch_channel_id text,
  watch_resource_id text,
  watch_expires timestamptz,
  last_sync_at timestamptz
);

-- Focus rooms ----------------------------------------------------------------

create table if not exists gk_focus_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  circle_id uuid references gk_circles(id) on delete cascade,
  name text not null,
  work_min int not null default 25 check (work_min between 5 and 120),
  break_min int not null default 5 check (break_min between 1 and 60),
  rounds int not null default 4 check (rounds between 1 and 12),
  started_at timestamptz,
  status text not null default 'waiting' check (status in ('waiting','running','done')),
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

create table if not exists gk_focus_participants (
  room_id uuid not null references gk_focus_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  intention text,
  done_note text,
  primary key (room_id, user_id)
);

-- Split tests and metrics ------------------------------------------------------

create table if not exists gk_experiments (
  id text primary key,
  name text not null,
  variants jsonb not null,                  -- [{key, weight, config}]
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists gk_experiment_assignments (
  experiment_id text not null references gk_experiments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  variant text not null,
  assigned_at timestamptz not null default now(),
  primary key (experiment_id, user_id)
);

create table if not exists gk_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists gk_events_name on gk_events(name, created_at);

-- Row-level security ----------------------------------------------------------

create or replace function gk_is_circle_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from gk_circle_members where circle_id = c and user_id = auth.uid())
$$;

create or replace function gk_owns_goal(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from gk_goals where id = g and owner_id = auth.uid())
$$;

alter table gk_profiles enable row level security;
alter table gk_templates enable row level security;
alter table gk_creators enable row level security;
alter table gk_template_reviews enable row level security;
alter table gk_library enable row level security;
alter table gk_purchases enable row level security;
alter table gk_circles enable row level security;
alter table gk_circle_members enable row level security;
alter table gk_goals enable row level security;
alter table gk_goal_fields enable row level security;
alter table gk_goal_summary_visibility enable row level security;
alter table gk_goal_viewers enable row level security;
alter table gk_plan_items enable row level security;
alter table gk_check_ins enable row level security;
alter table gk_consequences enable row level security;
alter table gk_encouragements enable row level security;
alter table gk_invites enable row level security;
alter table gk_meetups enable row level security;
alter table gk_reminders enable row level security;
alter table gk_push_subscriptions enable row level security;
alter table gk_calendar_links enable row level security;
alter table gk_focus_rooms enable row level security;
alter table gk_focus_participants enable row level security;
alter table gk_experiments enable row level security;
alter table gk_experiment_assignments enable row level security;
alter table gk_events enable row level security;

create policy gk_profiles_self on gk_profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy gk_templates_read on gk_templates for select using (status = 'published' or creator_id = auth.uid());
create policy gk_templates_creator_write on gk_templates for insert with check (creator_id = auth.uid() and tier in ('Creator','Custom') and status in ('draft','in_review'));
create policy gk_templates_creator_update on gk_templates for update using (creator_id = auth.uid() and status in ('draft','in_review','rejected'))
  with check (creator_id = auth.uid() and status in ('draft','in_review'));

create policy gk_creators_self on gk_creators for select using (user_id = auth.uid());
create policy gk_creators_apply on gk_creators for insert with check (user_id = auth.uid() and status = 'applied');

create policy gk_reviews_creator on gk_template_reviews for select using (
  exists (select 1 from gk_templates t where t.id = template_id and t.creator_id = auth.uid()));

create policy gk_library_self on gk_library for select using (user_id = auth.uid());
create policy gk_purchases_self on gk_purchases for select using (user_id = auth.uid());

create policy gk_circles_read on gk_circles for select using (owner_id = auth.uid() or gk_is_circle_member(id));
create policy gk_circles_insert on gk_circles for insert with check (owner_id = auth.uid());
create policy gk_circles_owner on gk_circles for update using (owner_id = auth.uid());
create policy gk_circles_delete on gk_circles for delete using (owner_id = auth.uid());

create policy gk_members_read on gk_circle_members for select using (gk_is_circle_member(circle_id) or
  exists (select 1 from gk_circles c where c.id = circle_id and c.owner_id = auth.uid()));
create policy gk_members_leave on gk_circle_members for delete using (user_id = auth.uid() or
  exists (select 1 from gk_circles c where c.id = circle_id and c.owner_id = auth.uid()));

create policy gk_goals_owner on gk_goals for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy gk_fields_owner on gk_goal_fields for all using (gk_owns_goal(goal_id)) with check (gk_owns_goal(goal_id));
create policy gk_sumvis_owner on gk_goal_summary_visibility for all using (gk_owns_goal(goal_id)) with check (gk_owns_goal(goal_id));
create policy gk_viewers_owner on gk_goal_viewers for all using (gk_owns_goal(goal_id)) with check (gk_owns_goal(goal_id));
create policy gk_viewers_self on gk_goal_viewers for select using (viewer_id = auth.uid());
create policy gk_plan_owner on gk_plan_items for all using (gk_owns_goal(goal_id)) with check (gk_owns_goal(goal_id));
create policy gk_checkins_owner on gk_check_ins for all using (user_id = auth.uid() and gk_owns_goal(goal_id))
  with check (user_id = auth.uid() and gk_owns_goal(goal_id));
create policy gk_conseq_owner on gk_consequences for all using (gk_owns_goal(goal_id) or set_by = auth.uid())
  with check (set_by = auth.uid());

create policy gk_enc_read on gk_encouragements for select using (from_id = auth.uid() or to_id = auth.uid()
  or (goal_id is not null and gk_owns_goal(goal_id)) or (circle_id is not null and gk_is_circle_member(circle_id)));
create policy gk_enc_send on gk_encouragements for insert with check (from_id = auth.uid());

create policy gk_invites_owner on gk_invites for all using (inviter_id = auth.uid()) with check (inviter_id = auth.uid());
create policy gk_meetups_read on gk_meetups for select using (gk_is_circle_member(circle_id));
create policy gk_meetups_write on gk_meetups for insert with check (created_by = auth.uid() and gk_is_circle_member(circle_id));

create policy gk_reminders_self on gk_reminders for all using (user_id = auth.uid()) with check (user_id = auth.uid() and gk_owns_goal(goal_id));
create policy gk_push_self on gk_push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- gk_calendar_links: no policies on purpose; server-only via service role.

create or replace function gk_in_room(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from gk_focus_participants where room_id = r and user_id = auth.uid())
      or exists (select 1 from gk_focus_rooms where id = r and (host_id = auth.uid()
           or (circle_id is not null and exists (select 1 from gk_circle_members m where m.circle_id = gk_focus_rooms.circle_id and m.user_id = auth.uid()))))
$$;

create policy gk_rooms_read on gk_focus_rooms for select using (gk_in_room(id));
create policy gk_rooms_host on gk_focus_rooms for all using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy gk_room_people_read on gk_focus_participants for select using (gk_in_room(room_id));
create policy gk_room_people_self on gk_focus_participants for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy gk_experiments_read on gk_experiments for select using (true);
create policy gk_assign_self on gk_experiment_assignments for select using (user_id = auth.uid());
create policy gk_events_insert on gk_events for insert with check (user_id = auth.uid());

-- Storage bucket for check-in photos, why-it-matters memos and voice notes (private; served by signed URL).
insert into storage.buckets (id, name, public) values ('gk-media', 'gk-media', false) on conflict (id) do nothing;
create policy gk_media_own_write on storage.objects for insert with check (bucket_id = 'gk-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy gk_media_own_read on storage.objects for select using (bucket_id = 'gk-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy gk_media_own_delete on storage.objects for delete using (bucket_id = 'gk-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Seed experiments named in PRD §5 (split tests built in).
insert into gk_experiments (id, name, variants) values
  ('onboarding_order', 'Onboarding order: tone before people vs after', '[{"key":"tone_first","weight":50},{"key":"people_first","weight":50}]'),
  ('first_week_size', 'First-week size', '[{"key":"small","weight":50,"config":{"scale":0.6}},{"key":"full","weight":50,"config":{"scale":1}}]'),
  ('reminder_timing', 'Reminder timing', '[{"key":"morning","weight":50,"config":{"time":"07:30"}},{"key":"evening","weight":50,"config":{"time":"19:00"}}]'),
  ('default_tone', 'Suggested tone', '[{"key":"coach","weight":50},{"key":"gentle","weight":50}]')
on conflict (id) do nothing;
