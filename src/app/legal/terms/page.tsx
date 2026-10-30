import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms", description: "GoalKin terms of use (draft, pending legal review)." };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className="text-sm text-muted">Last updated: [Effective date]. Provided by [Company legal name] (&ldquo;GoalKin&rdquo;, &ldquo;we&rdquo;).</p>
      <p>These terms cover your use of GoalKin: the website, the app, templates and programs. By making an account you agree to them. If you don&apos;t agree, please don&apos;t use GoalKin.</p>

      <h2>1. What GoalKin is</h2>
      <p>GoalKin helps you turn a goal into a plan, put it on your calendar, check in, and share progress with people you choose. Plans come from templates and from an AI that drafts suggestions based on your answers.</p>

      <h2>2. Plans are suggestions; you make the choices</h2>
      <ul>
        <li>Every plan is a suggestion. You can edit, move, remove or add any step, and you decide what to do.</li>
        <li>You are responsible for your choices and for doing things safely. Stop and get help if something feels wrong.</li>
        <li>We do not promise any result. How things turn out depends on you and on life.</li>
      </ul>

      <h2>3. Education, not medical or financial advice</h2>
      <ul>
        <li>GoalKin offers general education and structure. It is not medical, mental-health, nutrition, legal, tax or financial advice, and it does not replace a professional who knows your situation.</li>
        <li>Health, diet, weight, exercise and supplement plans include a required &ldquo;talk to your doctor&rdquo; step. Please do it before you start.</li>
        <li>Money plans include a reminder that they are not financial advice. Check big decisions with a qualified professional.</li>
        <li>If you have an emergency, contact local emergency services.</li>
      </ul>

      <h2>4. Your account</h2>
      <ul>
        <li>You need to be at least [minimum age, e.g. 16] to use GoalKin.</li>
        <li>Keep your sign-in secure. You are responsible for activity on your account.</li>
        <li>You can delete your account at any time (see the <Link href="/legal/privacy">Privacy notice</Link>).</li>
      </ul>

      <h2>5. Sharing and the people in your corner</h2>
      <p>Everything starts Private. You choose who sees each goal and each number (see the <Link href="/legal/privacy#rings">visibility rings</Link>). Please only invite people who want to be invited, and be kind: encouragement, dares and notes must not harass, threaten or shame anyone. Partner &ldquo;dares&rdquo; only apply if the goal owner accepts them.</p>

      <h2>6. Paid plans, programs and templates</h2>
      <ul>
        <li>Prices are shown before you buy. Plans (Pro, Circle, Club) renew each month or year until you cancel. Programs and templates are one-time purchases and stay in your library.</li>
        <li>Payments are processed by our payment processor, GoHighLevel, under its own terms. We don&apos;t see or store your full card details.</li>
        <li>Refunds: [Refund policy, e.g. within 14 days of purchase if you have not completed more than one week of the program]. Contact [Support email].</li>
        <li>If a payment fails or is reversed, paid features may stop until it is resolved.</li>
      </ul>

      <h2>7. Suggestions, add-ons and affiliate links</h2>
      <p>Some templates suggest optional add-on tracks, products or resources. These are always labeled as suggestions. Some links may be affiliate links, which means we may earn a commission if you buy; they are labeled, and it never changes the price you pay. See <Link href="/legal/notices">Notices and disclosures</Link>.</p>

      <h2 id="creators">8. Creator terms (summary)</h2>
      <ul>
        <li><b>Who:</b> approved creators (coaches, pastors, trainers, club leaders) can sell templates in the marketplace.</li>
        <li><b>Your content:</b> you keep ownership. You give GoalKin a worldwide, non-exclusive license to host, display, adapt (for example, fit the plan to a buyer&apos;s dates) and sell it in the app while it is listed, and to keep providing it to people who already bought it.</li>
        <li><b>Your promises:</b> the template is your original work or you have the rights to everything in it; it contains no medical, financial or guaranteed-result claims; health plans include the doctor step; and health and money numbers default to Private.</li>
        <li><b>Review:</b> every template is reviewed before it is published. We may request changes or decline. A reported template may be hidden while we look into it, and you can appeal.</li>
        <li><b>Revenue share:</b> 70% of each sale to you, 30% to GoalKin, after refunds and chargebacks. Payouts go to the account tied to your payout email on [payout schedule, e.g. monthly, with a minimum of $X].</li>
        <li><b>Taxes:</b> you are responsible for taxes on your earnings. We may ask for tax forms before paying out.</li>
        <li><b>Ending:</b> you can unpublish your templates at any time; buyers keep the version they bought.</li>
      </ul>

      <h2>9. Acceptable use</h2>
      <p>Don&apos;t misuse GoalKin: no illegal content, no harassment, no attempts to access other people&apos;s data, no scraping or overloading the service, and no selling content you don&apos;t have rights to.</p>

      <h2>10. Changes and ending the service</h2>
      <p>We may update GoalKin and these terms. If a change is important, we&apos;ll tell you before it takes effect. We may suspend accounts that break these terms.</p>

      <h2>11. Liability</h2>
      <p>GoalKin is provided &ldquo;as is&rdquo;. To the extent the law allows, [Company legal name] is not liable for indirect or consequential losses, and our total liability is limited to what you paid us in the 12 months before the claim. Nothing here limits rights you have under consumer law that can&apos;t be limited.</p>

      <h2>12. Contact</h2>
      <p>[Company legal name], [Company address]. Email: [Support email]. These terms are governed by the laws of [Governing law jurisdiction].</p>
    </>
  );
}
