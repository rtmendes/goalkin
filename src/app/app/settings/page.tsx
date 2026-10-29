import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { APPROACHES, APPROACH_QUESTIONS } from "@/lib/approach";
import { effectivePlan, limits } from "@/lib/entitlements";
import { env } from "@/lib/env";
import { TONES } from "@/lib/tone";
import type { Approach, ApproachWeights } from "@/lib/types";
import { Button, ButtonLink, Card, Field, Input, Notice, PageHeader, ProgressBar, Select } from "@/components/ui";
import { CopyField } from "@/components/settings/copy-field";
import { PushDevice } from "@/components/settings/push-device";
import { CHANNEL_LABEL, ReminderFields, WEEKDAYS } from "@/components/settings/reminder-fields";
import { ThemeSelect } from "@/components/settings/theme-select";
import { getCalendarStatus } from "@/lib/integrations/calendar-link";
import { googleConfigured } from "@/lib/integrations/gcal";
import {
  addReminder, deleteAccount, deleteReminder, disconnectGoogleAction, removeDevice, resetIcsLink,
  saveApproach, saveReminder, setGoalEmail, syncGoogleNow, updateProfile,
} from "./actions";

export const metadata: Metadata = { title: "Settings" };

const SAVED: Record<string, string> = {
  profile: "Profile saved.",
  approach: "Approach profile updated. New plans will use it.",
  ics: "New calendar link made. The old link no longer works; re-add the new one in your calendar app.",
  google_off: "Google Calendar disconnected and the Goals calendar removed.",
  synced: "Google Calendar is up to date.",
  reminder: "Reminder saved.",
  reminder_removed: "Reminder removed.",
  email_on: "Email reminders on for that goal.",
  email_off: "Email reminders off for that goal.",
  device_removed: "Device removed.",
};
const ERRORS: Record<string, string> = {
  profile: "Some profile values looked off. Please check them and save again.",
  approach: "Pick at least one answer to update your approach profile.",
  reminder: "That reminder couldn't be saved. Check the time and try again.",
  email: "That change didn't go through. Try again.",
  delete: "Type DELETE in capitals to confirm.",
  sync_plan: "Google Calendar sync is part of Pro.",
  sync_not_connected: "Connect Google Calendar first.",
  sync_not_configured: "Google Calendar isn't set up on this server yet.",
  sync_error: "Google didn't answer as expected. We'll retry automatically within the hour.",
};
const GOOGLE: Record<string, [string, "info" | "warn"]> = {
  connected: ["Google Calendar connected. Your plan is being added to a new calendar called \"Goals\".", "info"],
  denied: ["Google access wasn't granted, so nothing changed.", "warn"],
  expired: ["That sign-in took too long or came from another tab. Please try again.", "warn"],
  error: ["We couldn't finish connecting Google. Please try again.", "warn"],
  upgrade: ["Two-way Google Calendar sync is part of Pro. The calendar feed below works on every plan.", "info"],
  unavailable: ["Google Calendar isn't set up on this server yet. Use the calendar feed below.", "info"],
};

const fmt = (iso: string | null, tz: string) =>
  iso ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(new Date(iso)) : "never";

function deviceName(endpoint: string) {
  try {
    const host = new URL(endpoint).hostname;
    if (host.includes("google")) return "Chrome or Android";
    if (host.includes("mozilla")) return "Firefox";
    if (host.includes("apple")) return "Safari or iPhone";
    if (host.includes("windows") || host.includes("microsoft")) return "Edge or Windows";
    return host;
  } catch {
    return "Device";
  }
}

interface ReminderRow {
  id: string; goal_id: string; channel: keyof typeof CHANNEL_LABEL; cadence: string; time_of_day: string;
  weekday: number | null; active: boolean; last_sent_at: string | null; goal: { id: string; title: string; status: string } | null;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const { supabase, user, profile } = await requireUser("/app/settings");
  const plan = effectivePlan(profile);
  const canGoogle = limits(plan).googleSync;
  const tz = profile.timezone || "UTC";

  const [cal, remRes, goalRes, devRes] = await Promise.all([
    getCalendarStatus(user.id),
    supabase.from("gk_reminders").select("*, goal:gk_goals(id,title,status)").eq("user_id", user.id).order("created_at"),
    supabase.from("gk_goals").select("id,title,status").eq("owner_id", user.id).in("status", ["active", "paused", "draft"]).order("created_at"),
    supabase.from("gk_push_subscriptions").select("id,endpoint,created_at").eq("user_id", user.id).order("created_at"),
  ]);
  const reminders = (remRes.data ?? []) as ReminderRow[];
  const goals = (goalRes.data ?? []) as { id: string; title: string; status: string }[];
  const devices = (devRes.data ?? []) as { id: string; endpoint: string; created_at: string }[];
  const weights = (profile.approach ?? {}) as ApproachWeights;
  const zones = Intl.supportedValuesOf("timeZone");
  if (!zones.includes(tz)) zones.unshift(tz);

  const saved = one("saved");
  const error = one("error");
  const google = one("google");

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" sub="Your profile, calendar, reminders and data. Everything here is private to you." />
      {saved && SAVED[saved] && <Notice>{SAVED[saved]}</Notice>}
      {error && ERRORS[error] && <Notice tone="warn">{ERRORS[error]}</Notice>}

      <nav aria-label="Settings sections" className="flex flex-wrap gap-2 text-sm">
        {[["profile", "Profile"], ["approach", "Approach"], ["calendar", "Calendar"], ["notifications", "Notifications"], ["reminders", "Reminders"], ["data", "Your data"]].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-3 hover:bg-surface-2">{label}</a>
        ))}
      </nav>

      {/* Profile */}
      <Card id="profile" aria-labelledby="profile-h" className="scroll-mt-4">
        <h2 id="profile-h" className="font-display text-xl font-bold">Profile</h2>
        <form action={updateProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Display name" id="display_name" hint="What people in your corner see.">
            <Input id="display_name" name="display_name" maxLength={60} defaultValue={profile.display_name ?? ""} autoComplete="nickname" />
          </Field>
          <Field label="Time zone" id="timezone" hint="Reminders and calendar days use this.">
            <Select id="timezone" name="timezone" defaultValue={tz}>
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
            </Select>
          </Field>
          <Field label="Default tone" id="default_tone" hint="New goals start with this tone. Each goal can have its own.">
            <Select id="default_tone" name="default_tone" defaultValue={profile.default_tone}>
              {TONES.map((t) => <option key={t.id} value={t.id}>{t.name}: {t.blurb}</option>)}
            </Select>
          </Field>
          <Field label="Theme" id="theme">
            <ThemeSelect id="theme" defaultValue={profile.theme ?? "system"} />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-sm font-semibold">Quiet hours</legend>
            <p className="mb-2 text-xs text-muted">No reminders or nudges between these times.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" id="quiet_start"><Input id="quiet_start" name="quiet_start" type="time" required defaultValue={(profile.quiet_start ?? "21:00").slice(0, 5)} /></Field>
              <Field label="Until" id="quiet_end"><Input id="quiet_end" name="quiet_end" type="time" required defaultValue={(profile.quiet_end ?? "07:00").slice(0, 5)} /></Field>
            </div>
          </fieldset>
          <div className="sm:col-span-2"><Button type="submit">Save profile</Button></div>
        </form>
      </Card>

      {/* Approach profile */}
      <Card id="approach" aria-labelledby="approach-h" className="scroll-mt-4">
        <h2 id="approach-h" className="font-display text-xl font-bold">Approach profile</h2>
        <p className="mt-1 text-sm text-muted">How your plans are shaped. New plans blend your top two approaches.</p>
        <ul className="mt-4 space-y-3">
          {APPROACHES.map((a) => (
            <li key={a.id}>
              <ProgressBar value={Math.round((weights[a.id as Approach] ?? 0) * 100)} label={`${a.name} (${a.fits.toLowerCase()})`} />
            </li>
          ))}
        </ul>
        <details className="mt-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold underline">Retake the 5 questions</summary>
          <form action={saveApproach} className="mt-3 space-y-4">
            {APPROACH_QUESTIONS.map((q) => (
              <fieldset key={q.id} className="rounded-xl border border-line p-3">
                <legend className="px-1 font-semibold">{q.prompt}</legend>
                <div className="mt-2 grid gap-1">
                  {q.options.map((o, i) => (
                    <label key={o.label} className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-surface-2">
                      <input type="radio" name={q.id} value={i} className="h-5 w-5" />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <Button type="submit">Update my approach</Button>
          </form>
        </details>
      </Card>

      {/* Calendar */}
      <Card id="calendar" aria-labelledby="calendar-h" className="scroll-mt-4">
        <h2 id="calendar-h" className="font-display text-xl font-bold">Calendar</h2>
        {google && GOOGLE[google] && <div className="mt-3"><Notice tone={GOOGLE[google][1]}>{GOOGLE[google][0]}</Notice></div>}

        <h3 className="mt-4 font-semibold">Calendar feed (any calendar app)</h3>
        <p className="mt-1 text-sm text-muted">
          Subscribe by URL in Apple Calendar, Outlook or Google Calendar. It shows your plan for the last 2 weeks and next 4 months, with a one-tap check-in link in each event. Calendar apps refresh feeds on their own schedule, sometimes only every 12 to 24 hours.
        </p>
        {cal.icsUrl ? (
          <div className="mt-3 space-y-3">
            <CopyField id="ics-url" label="Your private feed link" value={cal.icsUrl} />
            <p className="text-xs text-muted">Anyone with this link can see your plan titles, so keep it to yourself. If it gets out, make a new one.</p>
            <div className="flex flex-wrap gap-2">
              <a className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2" href={cal.icsUrl.replace(/^https?:/, "webcal:")}>Open in my calendar app</a>
              <form action={resetIcsLink}><Button type="submit" variant="secondary">Reset link</Button></form>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Your feed link isn&apos;t available yet. Try again in a moment.</p>
        )}

        <h3 className="mt-6 font-semibold">Google Calendar two-way sync</h3>
        <p className="mt-1 text-sm text-muted">
          GoalKin makes its own calendar called &quot;Goals&quot; and only writes there. Move an event in Google and your plan follows.
        </p>
        <div className="mt-3 space-y-3">
          {!canGoogle ? (
            <Notice>Two-way Google sync is part of Pro. <Link className="underline" href="/pricing">See plans</Link>. The feed above works on every plan.</Notice>
          ) : !googleConfigured() ? (
            <Notice>Google Calendar isn&apos;t set up on this server yet. Use the feed above for now.</Notice>
          ) : cal.googleConnected ? (
            <>
              <p className="text-sm"><span aria-hidden className="text-sage-ink">✓</span> <span className="font-semibold">Connected.</span> Last sync: {fmt(cal.lastSyncAt, tz)}{cal.watchActive ? "; live updates on." : "; checking hourly."}</p>
              <div className="flex flex-wrap gap-2">
                <form action={syncGoogleNow}><Button type="submit" variant="secondary">Sync now</Button></form>
                <form action={disconnectGoogleAction}><Button type="submit" variant="danger">Disconnect and remove the Goals calendar</Button></form>
              </div>
            </>
          ) : (
            <>
              {/* A plain link: this is a route handler that redirects to Google. */}
              <a href="/api/google/oauth/start" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-[#F7F3EC] hover:opacity-90 dark:bg-gold dark:text-navy">Connect Google Calendar</a>
              <p className="text-xs text-muted">While Google reviews GoalKin, sync is limited to the first 100 people who connect. If Google says the app isn&apos;t verified yet, the feed above works for everyone.</p>
            </>
          )}
        </div>
      </Card>

      {/* Notifications */}
      <Card id="notifications" aria-labelledby="notifications-h" className="scroll-mt-4">
        <h2 id="notifications-h" className="font-display text-xl font-bold">Notifications</h2>
        <h3 className="mt-4 font-semibold">This device</h3>
        <div className="mt-2"><PushDevice vapidPublicKey={env.vapidPublicKey} /></div>

        <h3 className="mt-6 font-semibold">Devices with reminders on</h3>
        {devices.length ? (
          <ul className="mt-2 divide-y divide-line">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{deviceName(d.endpoint)} <span className="text-sm text-muted">· added {fmt(d.created_at, tz)}</span></span>
                <form action={removeDevice}><input type="hidden" name="id" value={d.id} /><Button type="submit" variant="ghost" aria-label={`Remove ${deviceName(d.endpoint)} added ${fmt(d.created_at, tz)}`}>Remove</Button></form>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-muted">No devices yet.</p>}

        <h3 className="mt-6 font-semibold">Email reminders by goal</h3>
        {goals.length ? (
          <ul className="mt-2 divide-y divide-line">
            {goals.map((g) => {
              const on = reminders.some((r) => r.goal_id === g.id && r.channel === "email" && r.active);
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{g.title}</span>{" "}
                    <span className={`text-sm ${on ? "text-sage-ink" : "text-muted"}`}>{on ? "✓ Email on" : "○ Email off"}</span>
                  </span>
                  <form action={setGoalEmail}>
                    <input type="hidden" name="goal_id" value={g.id} />
                    <input type="hidden" name="on" value={on ? "0" : "1"} />
                    <Button type="submit" variant="secondary" aria-label={`${on ? "Turn off" : "Turn on"} email reminders for ${g.title}`}>{on ? "Turn off" : "Turn on"}</Button>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-2 text-sm text-muted">Start a goal to set up reminders. <Link className="underline" href="/app/goals/new">New goal</Link></p>}
      </Card>

      {/* Reminders */}
      <Card id="reminders" aria-labelledby="reminders-h" className="scroll-mt-4">
        <h2 id="reminders-h" className="font-display text-xl font-bold">My reminders</h2>
        <p className="mt-1 text-sm text-muted">Wording follows each goal&apos;s tone. Calendar-only reminders live in your calendar app.</p>
        {reminders.length ? (
          <ul className="mt-4 space-y-3">
            {reminders.map((r) => (
              <li key={r.id} className="rounded-xl border border-line p-3">
                <p className="font-semibold">{r.goal?.title ?? "Goal"} <span className="text-sm font-normal text-muted">· {CHANNEL_LABEL[r.channel]}, {r.cadence === "weekly" ? `${WEEKDAYS[r.weekday ?? 1]}s` : r.cadence === "weekdays" ? "weekdays" : "daily"} at {r.time_of_day.slice(0, 5)}{r.active ? "" : " · paused"}</span></p>
                <details className="mt-2">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline">Edit</summary>
                  <form action={saveReminder} className="mt-2 space-y-3">
                    <input type="hidden" name="id" value={r.id} />
                    <ReminderFields idPrefix={`r-${r.id}`} channel={r.channel} cadence={r.cadence} time={r.time_of_day} weekday={r.weekday} />
                    <label className="flex min-h-11 items-center gap-3">
                      <input type="checkbox" name="active" defaultChecked={r.active} className="h-5 w-5" />
                      <span>On</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit">Save</Button>
                    </div>
                  </form>
                  <form action={deleteReminder} className="mt-2">
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" variant="ghost">Remove this reminder</Button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted">No reminders yet.</p>}

        {goals.length > 0 && (
          <details className="mt-4">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold underline">Add a reminder</summary>
            <form action={addReminder} className="mt-3 space-y-3">
              <Field label="Goal" id="new-goal">
                <Select id="new-goal" name="goal_id" required>
                  {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </Select>
              </Field>
              <ReminderFields idPrefix="new" />
              <Button type="submit">Add reminder</Button>
            </form>
          </details>
        )}
      </Card>

      {/* Data */}
      <Card id="data" aria-labelledby="data-h" className="scroll-mt-4">
        <h2 id="data-h" className="font-display text-xl font-bold">Your data</h2>
        <p className="mt-1 text-sm text-muted">Download everything GoalKin stores about you, or delete it.</p>
        <div className="mt-3"><ButtonLink href="/app/settings/export" variant="secondary" prefetch={false}>Export my data (JSON)</ButtonLink></div>
        <details className="mt-6">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-coral-ink underline">Delete my account</summary>
          <form action={deleteAccount} className="mt-3 space-y-3">
            <Notice tone="warn">This deletes your goals, plans, check-ins, circles you lead, reminders and calendar links, then signs you out. It can&apos;t be undone. Removing the login itself is done by support; contact us and we&apos;ll take care of it.</Notice>
            <Field label='Type "DELETE" to confirm' id="confirm"><Input id="confirm" name="confirm" autoComplete="off" required /></Field>
            <Button type="submit" variant="danger">Delete my GoalKin data</Button>
          </form>
        </details>
      </Card>
    </div>
  );
}
