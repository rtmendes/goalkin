import { type OnboardingTemplate } from "@/components/onboarding/flow";
import { OnboardingGate } from "@/components/onboarding/gate";
import { requireUser } from "@/lib/auth";
import { effectivePlan, limits } from "@/lib/entitlements";
import { variantFor } from "@/lib/experiments";
import { listTemplates } from "@/lib/templates";
import { canUseTemplate, loadTemplateBody } from "@/lib/goals-core/server";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template: templateParam } = await searchParams;
  const { supabase, user, profile } = await requireUser("/onboarding");
  const lim = limits(effectivePlan(profile));

  const [{ count: active }, { count: any }, { data: lib }, listings, order] = await Promise.all([
    supabase.from("gk_goals").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "active"),
    supabase.from("gk_goals").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    supabase.from("gk_library").select("template_id").eq("user_id", user.id),
    listTemplates().catch(() => []),
    variantFor("onboarding_order", user.id),
  ]);

  const owned = new Set((lib ?? []).map((l) => l.template_id as string));
  const templates: OnboardingTemplate[] = listings.map((t) => ({
    id: t.id, name: t.name, area: t.area, tier: t.tier, summary: t.summary,
    usable: t.tier === "Free" || owned.has(t.id) || t.creator_id === user.id,
  }));
  // Personal custom templates are drafts, so they are not in the published listing.
  let initialTemplate = null;
  if (templateParam) {
    const t = await loadTemplateBody(templateParam);
    if (t) initialTemplate = { body: t.body, usable: await canUseTemplate(supabase, user.id, t.listing) };
  }

  return (
    <OnboardingGate
      blocked={(active ?? 0) >= lim.activeGoals}
      userId={user.id}
      displayName={profile.display_name?.split(" ")[0] ?? null}
      templates={templates}
      order={order.key}
      allowed={lim.visibility}
      maxInvites={Number.isFinite(lim.chosenPeople) ? lim.chosenPeople : 5}
      defaultTone={profile.default_tone}
      aiAllowed={(any ?? 0) === 0 || lim.aiPlanBuilder}
      initialTemplate={initialTemplate}
    />
  );
}
