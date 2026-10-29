import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { ShareEditor } from "@/components/goals/share-editor";
import { InviteForm } from "@/components/goals/invite-form";
import { requireUser } from "@/lib/auth";
import { loadOwnGoal } from "@/lib/goals";
import { effectivePlan, limits } from "@/lib/entitlements";
import { env } from "@/lib/env";
import { removeViewer, revokeInvite } from "@/lib/goals-core/actions/share";
import { maybeAdmin } from "@/lib/goals-core/server";
import { formatDay } from "@/lib/goals-core/dates";

export const metadata = { title: "Sharing" };

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireUser(`/app/goals/${id}/share`);
  const bundle = await loadOwnGoal(id).catch(() => null);
  if (!bundle) notFound();
  const lim = limits(effectivePlan(profile));

  const [{ data: viewers }, { data: invites }] = await Promise.all([
    supabase.from("gk_goal_viewers").select("viewer_id, added_at").eq("goal_id", id),
    supabase.from("gk_invites").select("id, email, token, created_at, accepted_at").eq("goal_id", id).is("accepted_at", null).order("created_at"),
  ]);
  // Profiles are self-only under RLS; names of chosen people come through the service role.
  const names = new Map<string, string>();
  const admin = maybeAdmin();
  if (admin && viewers?.length) {
    const { data } = await admin.from("gk_profiles").select("id, display_name").in("id", viewers.map((v) => v.viewer_id));
    for (const p of data ?? []) names.set(p.id as string, (p.display_name as string) ?? "Someone");
  }
  const used = (viewers?.length ?? 0) + (invites?.length ?? 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Who's in your corner" sub={<>Sharing for <Link className="underline" href={`/app/goals/${id}`}>{bundle.goal.title}</Link>. Everything starts private.</>} />

      <ShareEditor goal={bundle.goal} fields={bundle.fields} summary={bundle.summary} checkIns={bundle.checkIns} planItems={bundle.planItems} allowed={lim.visibility} appUrl={env.appUrl} />

      <Card>
        <h2 className="font-display text-lg font-bold">Chosen people</h2>
        <p className="mb-3 text-sm text-muted">
          They see what the Chosen people preview shows, and only while the goal card is set to Chosen people or wider.
          {Number.isFinite(lim.chosenPeople) && <> Your plan includes {lim.chosenPeople} chosen person per goal ({used} used). <Link className="underline" href="/pricing">Upgrade</Link> for more.</>}
        </p>
        <ul className="mb-4 space-y-2">
          {(viewers ?? []).map((v) => (
            <li key={v.viewer_id as string} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
              <span><span aria-hidden>☺ </span>{names.get(v.viewer_id as string) ?? "A chosen person"} <span className="text-xs text-muted">since {formatDay(String(v.added_at).slice(0, 10))}</span></span>
              <form action={removeViewer}>
                <input type="hidden" name="goalId" value={id} /><input type="hidden" name="viewerId" value={v.viewer_id as string} />
                <button className="min-h-11 rounded-xl px-3 text-sm font-semibold text-coral-ink underline">Remove</button>
              </form>
            </li>
          ))}
          {(invites ?? []).map((inv) => (
            <li key={inv.id as string} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-line px-3 py-2">
              <span className="min-w-0">
                <span className="font-semibold">{inv.email as string}</span> <span className="text-xs text-muted">invite pending</span>
                <code className="mt-1 block break-all text-xs text-muted">{`${env.appUrl}/invite/${inv.token}`}</code>
              </span>
              <form action={revokeInvite}>
                <input type="hidden" name="goalId" value={id} /><input type="hidden" name="inviteId" value={inv.id as string} />
                <button className="min-h-11 rounded-xl px-3 text-sm font-semibold text-coral-ink underline">Cancel invite</button>
              </form>
            </li>
          ))}
          {!viewers?.length && !invites?.length && <li className="text-sm text-muted">No one yet.</li>}
        </ul>
        <InviteForm goalId={id} />
      </Card>
    </div>
  );
}
