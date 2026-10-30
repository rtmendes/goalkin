import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Notices and disclosures", description: "Health, money, affiliate and payment disclosures (draft, pending legal review)." };

export default function NoticesPage() {
  return (
    <>
      <h1>Notices and disclosures</h1>
      <p className="text-sm text-muted">Last updated: [Effective date]. [Company legal name].</p>

      <h2>No guaranteed results</h2>
      <p>GoalKin plans, templates and programs are suggestions to help you organize your effort. We don&apos;t promise any outcome, and examples on our site (like the people in sample screens) are made up to show how the app works. They are not testimonials or typical results.</p>

      <h2>Health: talk to your doctor</h2>
      <p>GoalKin offers education, not medical advice. Health, diet, weight, exercise and supplement plans start with a required &ldquo;talk to your doctor&rdquo; step that can&apos;t be removed from the plan. Talk to a qualified clinician before starting, especially if you have a health condition, take medication, or are pregnant. Stop if something hurts or feels wrong.</p>

      <h2>Money: not financial advice</h2>
      <p>Money templates (budgets, savings, debt payoff, side income) are general education, not financial, tax, legal or investment advice. Check big decisions with a qualified professional. Money numbers always start Private.</p>

      <h2>AI-drafted plans</h2>
      <p>Plans are drafted by AI from your answers and a template. AI can make mistakes; read your plan, change anything that doesn&apos;t fit, and use your own judgment. Required safety steps are added by GoalKin itself, not by the AI.</p>

      <h2>Suggestions and affiliate links</h2>
      <p>Some templates suggest optional add-on tracks, books, tools or products. These are labeled &ldquo;Suggestion&rdquo;. Some links may be affiliate links: if you buy through them, GoalKin or the template&apos;s creator may earn a commission at no extra cost to you. Affiliate links are labeled where they appear. Suggestions are never required to follow a plan.</p>

      <h2>Creator templates</h2>
      <p>Creator templates are made by independent coaches, pastors, trainers and club leaders, reviewed by GoalKin before publishing. Creators earn 70% of each sale; GoalKin keeps 30%. Creators are not GoalKin employees. See the <Link href="/legal/terms#creators">creator terms</Link>.</p>

      <h2>Payments</h2>
      <p>Checkout is provided by our payment processor, GoHighLevel, on its own order forms. Your purchase is linked to your GoalKin account by the email you use at checkout. See the <Link href="/legal/terms">Terms</Link> for renewals and refunds.</p>

      <h2>Visibility and sharing</h2>
      <p>Everything is Private by default. You choose who sees each goal and each number, and you always see a preview first. See <Link href="/legal/privacy#rings">how the rings work</Link>.</p>

      <h2>Contact</h2>
      <p>Questions about these notices: [Support email].</p>
    </>
  );
}
