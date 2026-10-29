import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, ButtonLink, Card, Notice, ProgressBar, StatusPill, inputCls } from "@/components/ui";
import { CheckInForm } from "@/components/goals/checkin-form";
import { BenchmarkChart } from "@/components/goals/benchmark-chart";
import { PlanEditor } from "@/components/goals/plan-editor";
import { requireUser } from "@/lib/auth";
import { loadOwnGoal } from "@/lib/goals";
import { effectivePlan, limits } from "@/lib/entitlements";
import { restartPlan } from "@/lib/progress";
import { TONES } from "@/lib/tone";
import { RING_LABEL, RINGS } from "@/lib/visibility";
import { areaInfo } from "@/lib/goals-core/areas";
import { formatDay, missedDays, primaryField, todayIn, weeklySeries } from "@/lib/goals-core/dates";
import { isMediaAudio, signedMedia } from "@/lib/goals-core/server";
import {
  addConsequence, addField, addReminder, deleteConsequence, deleteField, deleteReminder, rescheduleMissed, respondToDare,
  saveIfThen, setGoalStatus, updateField, updateGoalBasics, updateReminder,
} from "@/lib/goals-core/actions/goal";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await loadOwnGoal(id).catch(() => null);
  return { title: bundle?.goal.title ?? "Goal" };
}

const KINDS = [
  ["number", "Number"], ["yes_no", "Yes / no"], ["rating", "Rating 1 to 5"], ["money", "Money"], ["duration", "Minutes or hours"], ["percent", "Percent"], ["note", "Note"],
] as const;

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-display text-xl font-bold">{children}</h2>;
}

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await requireUser(`/app/goals/${id}`);
  const bundle = await loadOwnGoal(id).catch(() => null);
  if (!bundle) notFound();
  const { goal, fields, planItems, checkIns, progress } = bundle;
  const plan = effectivePlan(profile);
  const lim = limits(plan);
  const today = todayIn(profile.timezone);
  const area = areaInfo(goal.area);

  const [{ data: consequences }, { data: reminders }, whyMedia] = await Promise.all([
    supabase.from("gk_consequences").select("*").eq("goal_id", id).order("created_at"),
    supabase.from("gk_reminders").select("*").eq("goal_id", id).order("created_at"),
    signedMedia(supabase, goal.why_media_url),
  ]);

  const todays = checkIns.find((c) => c.day === today);
  const missed = goal.status === "active" ? missedDays(checkIns, goal.start_date, today) : 0;
  const field = primaryField(fields);
  const series = weeklySeries({ startDate: goal.start_date, today, checkIns, planItems, field });
  const overdue = planItems.filter((p) => !p.done && p.due_date && p.due_date < today).length;
  const hidden = (k: string) => <input type="hidden" name={k === "goal" ? "goalId" : k} value={id} />;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-line bg-surface p-4 sm:p-5" style={{ borderTop: `6px solid ${area.accent}` }}>
        <p className="text-sm font-semibold text-muted"><span aria-hidden>{area.icon} </span>{area.label}</p>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{goal.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <StatusPill status={progress.status} />
          <span>{RING_LABEL[goal.visibility]}</span>
          <span>· Started {formatDay(goal.start_date)}</span>
          {goal.finish_date && <span>· Finish by {formatDay(goal.finish_date)}</span>}
          {goal.status !== "active" && <span className="font-semibold capitalize text-ink">· {goal.status}</span>}
        </div>
        {goal.why && <p className="mt-3"><span className="font-semibold">Why it matters: </span>{goal.why}</p>}
        {whyMedia && (
          <details className="mt-2">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold text-sage-ink">Hard day? Open your why</summary>
            {isMediaAudio(goal.why_media_url)
              ? <audio controls src={whyMedia} className="w-full"><track kind="captions" /></audio>
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={whyMedia} alt="Your why-it-matters photo" className="mt-1 max-h-80 rounded-xl object-cover" />}
          </details>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/app/goals/${id}/share`} variant="secondary"><span aria-hidden>☺</span> Sharing</ButtonLink>
          {goal.status === "finished" && <ButtonLink href={`/app/goals/${id}/certificate`} variant="secondary"><span aria-hidden>★</span> Certificate</ButtonLink>}
        </div>
      </header>

      {goal.status === "active" && (
        <Card>
          <H2>Check in for today</H2>
          {todays && <p className="mb-2 text-sm text-muted">Today is logged as <strong>{todays.status}</strong>. Tap again to change it.</p>}
          <CheckInForm goalId={id} userId={user.id} fields={fields} trackingMode={goal.tracking_mode} current={todays?.status} />
        </Card>
      )}

      {missed >= 2 && (
        <Card>
          <H2>Restart plan</H2>
          <p className="mb-2 text-sm text-muted">{missed} days since your last check-in. Nothing is lost; here’s a gentle way back in.</p>
          <ul className="list-disc space-y-1 pl-5">{restartPlan(missed).map((r) => <li key={r}>{r}</li>)}</ul>
          {goal.restart_rule && <p className="mt-2 text-sm"><span className="font-semibold">Your template’s rule: </span>{goal.restart_rule}</p>}
          {overdue > 0 && (
            <form action={rescheduleMissed} className="mt-3">
              {hidden("goal")}
              <Button type="submit" variant="sage">Spread {overdue} missed step{overdue === 1 ? "" : "s"} over the next days</Button>
            </form>
          )}
        </Card>
      )}

      <Card>
        <H2>Progress</H2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3"><ProgressBar value={progress.percent} label={field?.target ? `${field.label} toward ${field.target}${field.unit ? " " + field.unit : ""}` : "Plan steps done"} /></div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-muted">Streak</p>
            <p className="font-display text-2xl font-bold">{progress.streak} day{progress.streak === 1 ? "" : "s"}</p>
            <p className="text-xs text-muted">One missed day is forgiven when you come back the next day.</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3 sm:col-span-2">
            <p className="text-xs text-muted">Last 7 days</p>
            <ul className="mt-1 flex flex-wrap gap-3 text-sm font-semibold">
              <li><span aria-hidden>✓ </span>{progress.scorecard.done} done</li>
              <li><span aria-hidden>◐ </span>{progress.scorecard.partly} partly</li>
              <li><span aria-hidden>○ </span>{progress.scorecard.missed} missed</li>
            </ul>
          </div>
        </div>
        <div className="mt-4">
          <BenchmarkChart points={series} label={field ? field.label : "Days checked in"} unit={field?.unit} />
        </div>
      </Card>

      <Card>
        <H2>Plan</H2>
        <p className="mb-3 text-sm text-muted">The AI drafts; you decide. Edit, move, remove or add anything. Steps marked Required are safety steps.</p>
        <PlanEditor goalId={id} startDate={goal.start_date} items={planItems} today={today} canRegenerate={lim.aiPlanBuilder} />
      </Card>

      <Card>
        <H2>Check-in history</H2>
        {checkIns.length === 0 ? <p className="text-sm text-muted">No check-ins yet.</p> : (
          <ul className="divide-y divide-line">
            {checkIns.slice(0, 30).map((c) => (
              <li key={c.id} className="flex flex-wrap gap-x-3 py-2 text-sm">
                <span className="w-28 text-muted">{formatDay(c.day)}</span>
                <span className="font-semibold capitalize"><span aria-hidden>{c.status === "done" ? "✓ " : c.status === "partly" ? "◐ " : "○ "}</span>{c.status}</span>
                {c.rating && <span>Rated {c.rating}/5</span>}
                {Object.entries(c.values ?? {}).map(([k, v]) => <span key={k}>{fields.find((f) => f.key === k)?.label ?? k}: {v}</span>)}
                {c.note && <span className="w-full text-muted">“{c.note}”</span>}
                {c.photo_url && <span className="text-xs text-muted">Photo saved</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <H2>What you track</H2>
        <p className="mb-3 text-sm text-muted">Each number has its own sharing switch. Health, money and weight numbers start private.</p>
        <ul className="space-y-2">
          {fields.map((f) => (
            <li key={f.id} className="rounded-xl border border-line p-3">
              <form action={updateField} className="grid gap-2 sm:grid-cols-4">
                {hidden("goal")}<input type="hidden" name="fieldId" value={f.id} />
                <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Label ({KINDS.find((k) => k[0] === f.kind)?.[1] ?? f.kind})</span>
                  <input name="label" defaultValue={f.label} maxLength={60} className={inputCls} /></label>
                <label><span className="mb-1 block text-xs font-semibold">Unit</span><input name="unit" defaultValue={f.unit ?? ""} maxLength={20} className={inputCls} /></label>
                <label><span className="mb-1 block text-xs font-semibold">Target</span><input name="target" type="number" step="any" min={0} defaultValue={f.target ?? ""} className={inputCls} /></label>
                <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Who sees it</span>
                  <select name="visibility" defaultValue={f.visibility} className={inputCls}>
                    {RINGS.map((r) => <option key={r} value={r} disabled={!lim.visibility.includes(r)}>{RING_LABEL[r]}{lim.visibility.includes(r) ? "" : " (Pro)"}</option>)}
                  </select></label>
                <div className="flex items-end gap-2 sm:col-span-2"><Button type="submit" variant="secondary">Save</Button></div>
              </form>
              <form action={deleteField} className="mt-1">
                {hidden("goal")}<input type="hidden" name="fieldId" value={f.id} />
                <button className="min-h-11 text-sm font-semibold text-coral-ink underline">Stop tracking {f.label}</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addField} className="mt-3 grid gap-2 rounded-xl border border-dashed border-line p-3 sm:grid-cols-4">
          {hidden("goal")}
          <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">New thing to track</span><input name="label" required maxLength={60} className={inputCls} placeholder="e.g. Pages read" /></label>
          <label><span className="mb-1 block text-xs font-semibold">Kind</span>
            <select name="kind" className={inputCls} defaultValue="number">{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-semibold">Unit</span><input name="unit" maxLength={20} className={inputCls} /></label>
          <label><span className="mb-1 block text-xs font-semibold">Target</span><input name="target" type="number" step="any" min={0} className={inputCls} /></label>
          <label><span className="mb-1 block text-xs font-semibold">Who sees it</span>
            <select name="visibility" defaultValue="private" className={inputCls}>
              {RINGS.map((r) => <option key={r} value={r} disabled={!lim.visibility.includes(r)}>{RING_LABEL[r]}</option>)}
            </select></label>
          <div className="flex items-end sm:col-span-2"><Button type="submit">Add</Button></div>
        </form>
        {goal.tracking_mode !== "detailed" && fields.length > 0 && <p className="mt-2 text-xs text-muted">Numbers appear in check-ins when tracking is set to Detailed (see Settings for this goal below).</p>}
      </Card>

      <Card>
        <H2>If-then plans</H2>
        <p className="mb-3 text-sm text-muted">Decide now what you’ll do when things go sideways. Leave a row empty to remove it.</p>
        <form action={saveIfThen} className="space-y-2">
          {hidden("goal")}
          {[...goal.if_then, { if: "", then: "" }, { if: "", then: "" }].slice(0, 8).map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <label><span className="mb-1 block text-xs font-semibold">If...</span><input name="if" defaultValue={r.if} maxLength={140} className={inputCls} placeholder="I miss Tuesday" /></label>
              <label><span className="mb-1 block text-xs font-semibold">Then I...</span><input name="then" defaultValue={r.then} maxLength={140} className={inputCls} placeholder="run Wednesday at 6" /></label>
            </div>
          ))}
          <Button type="submit" variant="secondary">Save if-then plans</Button>
        </form>
      </Card>

      <Card>
        <H2>Stakes</H2>
        <p className="mb-3 text-sm text-muted">Optional. Something you set for yourself, or a dare from someone in your corner that you choose to accept.</p>
        <ul className="mb-3 space-y-2">
          {(consequences ?? []).map((c) => {
            const dare = c.kind === "partner_dare" && c.set_by !== user.id;
            return (
              <li key={c.id as string} className="rounded-xl border border-line p-3 text-sm">
                <p><span className="font-semibold">{dare ? "Dare from a partner" : c.kind === "cause_pledge" ? "Cause pledge" : "Self-set"}: </span>{c.description as string}</p>
                {c.trigger_rule && <p className="text-xs text-muted">When: {c.trigger_rule as string}</p>}
                {dare && !c.accepted ? (
                  <div className="mt-2 flex gap-2">
                    <form action={respondToDare}>{hidden("goal")}<input type="hidden" name="consequenceId" value={c.id as string} /><input type="hidden" name="answer" value="accept" /><Button type="submit" variant="sage">Accept</Button></form>
                    <form action={respondToDare}>{hidden("goal")}<input type="hidden" name="consequenceId" value={c.id as string} /><input type="hidden" name="answer" value="decline" /><Button type="submit" variant="secondary">Decline</Button></form>
                  </div>
                ) : (
                  <form action={deleteConsequence} className="mt-1">{hidden("goal")}<input type="hidden" name="consequenceId" value={c.id as string} />
                    <button className="min-h-11 text-sm font-semibold text-coral-ink underline">Remove</button></form>
                )}
              </li>
            );
          })}
        </ul>
        <form action={addConsequence} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          {hidden("goal")}
          <label><span className="mb-1 block text-xs font-semibold">If I fall behind, I will...</span><input name="description" required maxLength={280} className={inputCls} placeholder="Skip takeout for a week" /></label>
          <label><span className="mb-1 block text-xs font-semibold">When (optional)</span><input name="trigger" maxLength={140} className={inputCls} placeholder="Two missed weeks in a row" /></label>
          <div className="flex items-end"><Button type="submit" variant="secondary">Add</Button></div>
        </form>
      </Card>

      <Card>
        <H2>Reminders</H2>
        <ul className="mb-3 space-y-2">
          {(reminders ?? []).map((r) => (
            <li key={r.id as string} className="rounded-xl border border-line p-3">
              <form action={updateReminder} className="flex flex-wrap items-end gap-2">
                {hidden("goal")}<input type="hidden" name="reminderId" value={r.id as string} />
                <p className="w-full text-sm font-semibold capitalize">{r.channel as string}</p>
                <label><span className="mb-1 block text-xs font-semibold">How often</span>
                  <select name="cadence" defaultValue={r.cadence as string} className={inputCls}><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option></select></label>
                <label><span className="mb-1 block text-xs font-semibold">Time</span><input type="time" name="time" defaultValue={String(r.time_of_day).slice(0, 5)} className={inputCls} /></label>
                <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={!!r.active} className="h-5 w-5" /> On</label>
                <Button type="submit" variant="secondary">Save</Button>
              </form>
              <form action={deleteReminder}>{hidden("goal")}<input type="hidden" name="reminderId" value={r.id as string} />
                <button className="min-h-11 text-sm font-semibold text-coral-ink underline">Delete</button></form>
            </li>
          ))}
          {!reminders?.length && <li className="text-sm text-muted">No reminders for this goal.</li>}
        </ul>
        <form action={addReminder} className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-line p-3">
          {hidden("goal")}
          <label><span className="mb-1 block text-xs font-semibold">Channel</span>
            <select name="channel" className={inputCls}><option value="email">Email</option><option value="push">Push</option><option value="calendar">Calendar</option></select></label>
          <label><span className="mb-1 block text-xs font-semibold">How often</span>
            <select name="cadence" className={inputCls}><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option></select></label>
          <label><span className="mb-1 block text-xs font-semibold">Day (weekly)</span>
            <select name="weekday" className={inputCls} defaultValue="1">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-semibold">Time</span><input type="time" name="time" defaultValue="08:00" required className={inputCls} /></label>
          <Button type="submit">Add reminder</Button>
        </form>
        <p className="mt-2 text-xs text-muted">Quiet hours and channels are in <Link href="/app/settings" className="underline">Settings</Link>.</p>
      </Card>

      <Card>
        <H2>Goal settings</H2>
        <form action={updateGoalBasics} className="grid gap-3 sm:grid-cols-2">
          {hidden("goal")}
          <label className="sm:col-span-2"><span className="mb-1 block text-sm font-semibold">Goal</span><input name="title" defaultValue={goal.title} minLength={2} maxLength={140} className={inputCls} /></label>
          <label className="sm:col-span-2"><span className="mb-1 block text-sm font-semibold">Why it matters</span><textarea name="why" defaultValue={goal.why ?? ""} maxLength={1000} className={`${inputCls} min-h-20`} /></label>
          <label><span className="mb-1 block text-sm font-semibold">Finish by</span><input type="date" name="finish_date" defaultValue={goal.finish_date ?? ""} className={inputCls} /></label>
          <label><span className="mb-1 block text-sm font-semibold">Tone</span>
            <select name="tone" defaultValue={goal.tone} className={inputCls}>{TONES.map((t) => <option key={t.id} value={t.id}>{t.name}: {t.blurb}</option>)}</select></label>
          <label><span className="mb-1 block text-sm font-semibold">Tracking</span>
            <select name="tracking_mode" defaultValue={goal.tracking_mode} className={inputCls}>
              <option value="simple">Simple: done, partly, missed</option><option value="detailed">Detailed: numbers too</option><option value="reflective">Reflective: a short note</option>
            </select></label>
          <div className="flex items-end"><Button type="submit" variant="secondary">Save settings</Button></div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          {goal.status === "active" && (
            <>
              <form action={setGoalStatus}>{hidden("goal")}<input type="hidden" name="status" value="paused" /><Button type="submit" variant="secondary">Pause</Button></form>
              <form action={setGoalStatus}>{hidden("goal")}<input type="hidden" name="status" value="finished" /><Button type="submit" variant="sage"><span aria-hidden>★</span> I finished!</Button></form>
            </>
          )}
          {(goal.status === "paused" || goal.status === "finished" || goal.status === "archived") && (
            <form action={setGoalStatus}>{hidden("goal")}<input type="hidden" name="status" value="active" /><Button type="submit" variant="secondary">Make active again</Button></form>
          )}
          {goal.status !== "archived" && (
            <form action={setGoalStatus}>{hidden("goal")}<input type="hidden" name="status" value="archived" /><Button type="submit" variant="ghost">Archive</Button></form>
          )}
        </div>
        {plan === "free" && <div className="mt-3"><Notice>Free holds one active goal. Pausing this one frees the slot.</Notice></div>}
      </Card>
    </div>
  );
}
