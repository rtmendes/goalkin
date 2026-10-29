"use server";
import * as z from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { APPROACH_QUESTIONS, scoreApproach } from "@/lib/approach";
import { TONES } from "@/lib/tone";
import { deleteCalendarLink, resetIcsToken } from "@/lib/integrations/calendar-link";
import { disconnectGoogle, syncUser } from "@/lib/integrations/gcal";

const done = (saved: string, anchor: string): never => {
  revalidatePath("/app/settings");
  redirect(`/app/settings?saved=${saved}#${anchor}`);
};

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);
const tone = z.enum(TONES.map((t) => t.id) as [string, ...string[]]);
const zones = new Set(Intl.supportedValuesOf("timeZone").concat("UTC"));

const ProfileForm = z.object({
  display_name: z.string().trim().max(60),
  timezone: z.string().refine((tz) => zones.has(tz), "Pick a time zone from the list."),
  default_tone: tone,
  quiet_start: hhmm,
  quiet_end: hhmm,
  theme: z.enum(["system", "light", "dark"]),
});

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser("/app/settings");
  const parsed = ProfileForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/app/settings?error=profile#profile");
  const { display_name, ...rest } = parsed.data;
  await supabase.from("gk_profiles").update({ ...rest, display_name: display_name || null }).eq("id", user.id);
  done("profile", "profile");
}

export async function saveApproach(formData: FormData) {
  const { supabase, user } = await requireUser("/app/settings");
  const answers: Record<string, number> = {};
  for (const q of APPROACH_QUESTIONS) {
    const v = Number(formData.get(q.id));
    if (Number.isInteger(v) && v >= 0 && v < q.options.length) answers[q.id] = v;
  }
  if (!Object.keys(answers).length) redirect("/app/settings?error=approach#approach");
  await supabase.from("gk_profiles").update({ approach: scoreApproach(answers) }).eq("id", user.id);
  done("approach", "approach");
}

export async function resetIcsLink() {
  const { user } = await requireUser("/app/settings");
  await resetIcsToken(user.id);
  done("ics", "calendar");
}

export async function disconnectGoogleAction() {
  const { user } = await requireUser("/app/settings");
  await disconnectGoogle(user.id);
  done("google_off", "calendar");
}

export async function syncGoogleNow() {
  const { user } = await requireUser("/app/settings");
  const r = await syncUser(user.id);
  if (!r.ok) redirect(`/app/settings?error=sync_${r.reason}#calendar`);
  done("synced", "calendar");
}

const ReminderFields = z.object({
  channel: z.enum(["email", "push", "calendar"]),
  cadence: z.enum(["daily", "weekdays", "weekly"]),
  time_of_day: hhmm,
  weekday: z.coerce.number().int().min(0).max(6).optional(),
});

function reminderValues(formData: FormData) {
  const parsed = ReminderFields.safeParse({
    channel: formData.get("channel"),
    cadence: formData.get("cadence"),
    time_of_day: formData.get("time_of_day"),
    weekday: formData.get("weekday") || undefined,
  });
  if (!parsed.success) return null;
  const v = parsed.data;
  return { ...v, weekday: v.cadence === "weekly" ? v.weekday ?? 1 : null };
}

export async function saveReminder(formData: FormData) {
  const { supabase, user } = await requireUser("/app/settings");
  const id = z.uuid().safeParse(formData.get("id"));
  const values = reminderValues(formData);
  if (!id.success || !values) redirect("/app/settings?error=reminder#reminders");
  // Changing the time re-arms today's reminder.
  await supabase.from("gk_reminders").update({ ...values, active: formData.get("active") === "on", last_sent_at: null }).eq("id", id.data).eq("user_id", user.id);
  done("reminder", "reminders");
}

export async function addReminder(formData: FormData) {
  const { supabase, user } = await requireUser("/app/settings");
  const goal = z.uuid().safeParse(formData.get("goal_id"));
  const values = reminderValues(formData);
  if (!goal.success || !values) redirect("/app/settings?error=reminder#reminders");
  // RLS checks that the goal is the person's own.
  const { error } = await supabase.from("gk_reminders").insert({ ...values, goal_id: goal.data, user_id: user.id, active: true });
  if (error) redirect("/app/settings?error=reminder#reminders");
  done("reminder", "reminders");
}

export async function deleteReminder(formData: FormData) {
  const { supabase, user } = await requireUser("/app/settings");
  const id = z.uuid().safeParse(formData.get("id"));
  if (id.success) await supabase.from("gk_reminders").delete().eq("id", id.data).eq("user_id", user.id);
  done("reminder_removed", "reminders");
}

/** Email on/off for one goal: reuses an existing email reminder row when there is one. */
export async function setGoalEmail(formData: FormData) {
  const { supabase, user, profile } = await requireUser("/app/settings");
  const goal = z.uuid().safeParse(formData.get("goal_id"));
  if (!goal.success) redirect("/app/settings?error=email#notifications");
  const on = formData.get("on") === "1";
  const { data: rows } = await supabase.from("gk_reminders").select("id").eq("goal_id", goal.data).eq("user_id", user.id).eq("channel", "email");
  if (rows?.length) {
    await supabase.from("gk_reminders").update({ active: on }).in("id", rows.map((r) => r.id as string));
  } else if (on) {
    const cadence = TONES.find((t) => t.id === profile.default_tone)?.defaultCadence ?? "daily";
    await supabase.from("gk_reminders").insert({ goal_id: goal.data, user_id: user.id, channel: "email", cadence, weekday: cadence === "weekly" ? 1 : null, time_of_day: "08:00", active: true });
  }
  done(on ? "email_on" : "email_off", "notifications");
}

export async function removeDevice(formData: FormData) {
  const { supabase, user } = await requireUser("/app/settings");
  const id = z.uuid().safeParse(formData.get("id"));
  if (id.success) await supabase.from("gk_push_subscriptions").delete().eq("id", id.data).eq("user_id", user.id);
  done("device_removed", "notifications");
}

/**
 * Deletes the person's GoalKin data through RLS (goals cascade to plans,
 * check-ins and sharing), disconnects Google and signs out. Removing the login
 * itself is done by support.
 */
export async function deleteAccount(formData: FormData) {
  const { supabase, user } = await requireUser("/app/settings");
  if (String(formData.get("confirm") ?? "").trim() !== "DELETE") redirect("/app/settings?error=delete#data");
  await disconnectGoogle(user.id).catch(() => null);
  await deleteCalendarLink(user.id).catch(() => null);
  const me = user.id;
  await supabase.from("gk_reminders").delete().eq("user_id", me);
  await supabase.from("gk_push_subscriptions").delete().eq("user_id", me);
  await supabase.from("gk_invites").delete().eq("inviter_id", me);
  await supabase.from("gk_focus_participants").delete().eq("user_id", me);
  await supabase.from("gk_focus_rooms").delete().eq("host_id", me);
  await supabase.from("gk_circle_members").delete().eq("user_id", me);
  await supabase.from("gk_goals").delete().eq("owner_id", me);
  await supabase.from("gk_circles").delete().eq("owner_id", me);
  await supabase.from("gk_profiles").delete().eq("id", me);
  await supabase.auth.signOut();
  redirect("/?account=deleted");
}
