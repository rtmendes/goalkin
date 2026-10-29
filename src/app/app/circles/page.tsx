import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Card, Empty, Field, Input, Notice, PageHeader, Select, Textarea } from "@/components/ui";
import { Flash } from "@/components/people/flash";
import { SubmitButton } from "@/components/people/submit-button";
import { requireUser } from "@/lib/auth";
import { memberCount, planLimits } from "@/lib/people/server";
import { TONES } from "@/lib/tone";
import type { Circle } from "@/lib/types";
import { createCircle } from "./actions";

export const metadata: Metadata = { title: "Circles" };

const KIND_LABEL: Record<Circle["kind"], string> = { pair: "Pair", group: "Group", club: "Club" };

export default async function CirclesPage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { n } = await searchParams;
  const { supabase, user, profile } = await requireUser("/app/circles");
  const lim = planLimits(profile);

  const [{ data: memberships }, { data: owned }] = await Promise.all([
    supabase.from("gk_circle_members").select("circle_id, role").eq("user_id", user.id),
    supabase.from("gk_circles").select("*").eq("owner_id", user.id),
  ]);
  const roleById = new Map((memberships ?? []).map((m) => [m.circle_id as string, m.role as string]));
  const otherIds = [...roleById.keys()].filter((id) => !(owned ?? []).some((c) => c.id === id));
  const { data: joined } = otherIds.length ? await supabase.from("gk_circles").select("*").in("id", otherIds) : { data: [] };
  const circles = [...((owned ?? []) as Circle[]), ...((joined ?? []) as Circle[])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const counts = await Promise.all(circles.map((c) => memberCount(c.id)));

  return (
    <div className="space-y-6">
      <PageHeader title="Circles" sub="The people in your corner. Pairs, small groups and clubs." />
      <Flash code={n} />

      <section aria-labelledby="mine">
        <h2 id="mine" className="mb-3 font-display text-xl font-bold">Your circles</h2>
        {circles.length === 0 ? (
          <Empty title="No circles yet">
            Start one below, or open an invite link someone sent you.
          </Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {circles.map((c, i) => (
              <li key={c.id}>
                <Link href={`/app/circles/${c.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
                  <span className="block font-semibold">{c.name}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {KIND_LABEL[c.kind]} · {counts[i]} of {c.max_members} · {c.owner_id === user.id ? "You lead" : roleById.get(c.id) === "leader" ? "Leader" : "Member"}
                  </span>
                  {c.description && <span className="mt-2 line-clamp-2 block text-sm">{c.description}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card aria-labelledby="new">
        <h2 id="new" className="font-display text-xl font-bold">Start a circle</h2>
        {!lim.leadCircles ? (
          <div className="mt-3 space-y-3">
            <Notice>Leading a circle is part of Pro and up. You can still join any circle you&apos;re invited to on the Free plan.</Notice>
            <ButtonLink href="/pricing">See plans</ButtonLink>
          </div>
        ) : (
          <form action={createCircle} className="mt-3 space-y-4">
            <Field label="Name" id="c-name">
              <Input id="c-name" name="name" required maxLength={80} placeholder="Sunday Runners" />
            </Field>
            <Field label="What it's for (optional)" id="c-desc">
              <Textarea id="c-desc" name="description" maxLength={500} placeholder="We train together for the spring 10K." />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kind" id="c-kind" hint={`A pair is you plus one. Groups and clubs hold up to ${lim.circleMembers} on your plan.`}>
                <Select id="c-kind" name="kind" defaultValue="group">
                  <option value="pair">Pair (2 people)</option>
                  <option value="group">Group</option>
                  <option value="club">Club</option>
                </Select>
              </Field>
              <Field label="Tone" id="c-tone">
                <Select id="c-tone" name="tone" defaultValue={profile.default_tone}>
                  {TONES.map((t) => <option key={t.id} value={t.id}>{t.name}: {t.blurb}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Program (optional)" id="c-prog" hint="The plan you're following together, in your own words.">
              <Textarea id="c-prog" name="program" maxLength={2000} placeholder="Three runs a week. Long run on Sundays. Check in by 8pm." />
            </Field>
            <Notice>Starting a circle shares your name with the people you invite. Your goals stay private unless you choose.</Notice>
            <SubmitButton pendingText="Creating…">Create circle</SubmitButton>
          </form>
        )}
      </Card>
    </div>
  );
}
