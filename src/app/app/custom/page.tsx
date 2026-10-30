import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { CustomBuilder } from "@/components/goals/custom-builder";
import { requireUser } from "@/lib/auth";
import { effectivePlan, limits } from "@/lib/entitlements";

export const metadata = { title: "Custom template" };

export default async function CustomTemplatePage() {
  const { profile } = await requireUser("/app/custom");
  const pro = limits(effectivePlan(profile)).aiPlanBuilder;
  return (
    <div className="space-y-5">
      <PageHeader title="Build your own template" sub="A deeper interview, an AI draft, then your edits. Saved privately to your library." />
      {pro ? (
        <CustomBuilder />
      ) : (
        <Card>
          <h2 className="font-display text-xl font-bold">This is a Pro feature</h2>
          <p className="mt-2 text-muted">Pro unlocks the advanced custom template: about a dozen questions on where you are, what gets in the way and how you want to restart, then a full plan you can edit and reuse.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href="/pricing">See Pro</ButtonLink>
            <ButtonLink href="/app/goals/new" variant="secondary">Start a goal instead</ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}
