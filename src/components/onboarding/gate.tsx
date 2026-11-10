"use client";
import { useState, type ComponentProps } from "react";
import { ButtonLink, Card } from "@/components/ui";
import { OnboardingFlow } from "@/components/onboarding/flow";

/**
 * Decides once, on first load, whether the plan limit blocks a new goal. Saving the goal
 * re-renders the page on the server, which then sees an active goal; reading the limit only
 * at mount keeps the flow (and its "plan built" screen) on screen instead of swapping it out.
 */
export function OnboardingGate({ blocked, ...flow }: { blocked: boolean } & ComponentProps<typeof OnboardingFlow>) {
  const [blockedAtLoad] = useState(blocked);
  if (!blockedAtLoad) return <OnboardingFlow {...flow} />;
  return (
    <Card>
      <h1 className="font-display text-2xl font-bold">You already have an active goal</h1>
      <p className="mt-2 text-muted">The free plan holds one active goal at a time. Pause or finish it to start another, or upgrade for unlimited goals.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href="/app/goals">My goals</ButtonLink>
        <ButtonLink href="/pricing" variant="secondary">See Pro</ButtonLink>
      </div>
    </Card>
  );
}
