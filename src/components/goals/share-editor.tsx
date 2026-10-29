"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Notice } from "@/components/ui";
import { RingPicker } from "@/components/goals/ring-picker";
import { PreviewTabs } from "@/components/goals/preview-tabs";
import { CopyButton } from "@/components/goals/copy-button";
import { saveShareSettings } from "@/lib/goals-core/actions/share";
import { SUMMARY_KEYS } from "@/lib/goals-core/rules";
import type { CheckIn, Goal, GoalField, PlanItem, SummaryVisibility, Visibility } from "@/lib/types";

export function ShareEditor({
  goal, fields, summary, checkIns, planItems, allowed, appUrl,
}: {
  goal: Goal;
  fields: GoalField[];
  summary: Omit<SummaryVisibility, "goal_id">;
  checkIns: CheckIn[];
  planItems: PlanItem[];
  allowed: Visibility[];
  appUrl: string;
}) {
  const [ring, setRing] = useState<Visibility>(goal.visibility);
  const [sum, setSum] = useState(summary);
  const [fieldRings, setFieldRings] = useState<Record<string, Visibility>>(Object.fromEntries(fields.map((f) => [f.id, f.visibility])));
  const [publicLink, setPublicLink] = useState(!!goal.share_token);
  const [token, setToken] = useState(goal.share_token);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const liveGoal: Goal = { ...goal, visibility: ring };
  const liveFields = fields.map((f) => ({ ...f, visibility: fieldRings[f.id] ?? f.visibility }));

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveShareSettings({ goalId: goal.id, visibility: ring, summary: sum, fields: fieldRings, publicLink: ring === "public" && publicLink });
      if (res.ok) {
        setToken(res.shareToken);
        setMsg({ ok: true, text: "Saved. The preview above is exactly what each group sees now." });
      } else setMsg({ ok: false, text: res.error });
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,22rem)]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-lg font-bold">Who sees this goal at all</h2>
          <p className="mb-3 text-sm text-muted">Nobody outside this ring sees anything, not even the title.</p>
          <RingPicker legend="Goal card" value={ring} onChange={setRing} allowed={allowed} />
          {!allowed.includes("circle") && (
            <p className="mt-2 text-xs text-muted">Free covers Only me and one chosen person. <Link className="underline" href="/pricing">See Pro</Link> for circle and public sharing.</p>
          )}
          {ring === "public" && (
            <div className="mt-4 rounded-xl bg-surface-2 p-3">
              <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
                <input type="checkbox" className="h-5 w-5" checked={publicLink} onChange={(e) => setPublicLink(e.target.checked)} />
                Make a public link anyone can open
              </label>
              {token && publicLink && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <code className="break-all rounded bg-surface px-2 py-1">{`${appUrl}/s/${token}`}</code>
                  <CopyButton text={`${appUrl}/s/${token}`} />
                </div>
              )}
              {publicLink && !token && <p className="mt-1 text-xs text-muted">The link appears after you save.</p>}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-lg font-bold">Summary values</h2>
          <p className="mb-3 text-sm text-muted">Each one has its own switch. A value set to Circle is also seen by chosen people.</p>
          <div className="space-y-4">
            {SUMMARY_KEYS.map((k) => (
              <RingPicker key={k.key} legend={k.label} hint={k.hint} value={sum[k.key]} allowed={allowed}
                onChange={(v) => setSum((s) => ({ ...s, [k.key]: v }))} />
            ))}
          </div>
        </section>

        {fields.length > 0 && (
          <section className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="font-display text-lg font-bold">Tracked numbers and notes</h2>
            <p className="mb-3 text-sm text-muted">Health, money and weight numbers start private. You decide.</p>
            <div className="space-y-4">
              {fields.map((f) => (
                <RingPicker key={f.id} legend={f.label} value={fieldRings[f.id] ?? f.visibility} allowed={allowed}
                  onChange={(v) => setFieldRings((s) => ({ ...s, [f.id]: v }))} />
              ))}
            </div>
          </section>
        )}

        <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur md:bottom-4">
          <Button type="button" onClick={save} disabled={pending}>{pending ? "Saving..." : "Save sharing"}</Button>
          <p aria-live="polite" className={`text-sm ${msg && !msg.ok ? "text-coral-ink" : "text-muted"}`}>{msg?.text ?? "Nothing changes until you save."}</p>
        </div>
      </div>
      <div className="lg:sticky lg:top-4 lg:self-start">
        <PreviewTabs goal={liveGoal} fields={liveFields} summary={sum} checkIns={checkIns} planItems={planItems} note="live preview" />
        {ring === "private" && <div className="mt-3"><Notice>This goal is private. Only you can see it.</Notice></div>}
      </div>
    </div>
  );
}
