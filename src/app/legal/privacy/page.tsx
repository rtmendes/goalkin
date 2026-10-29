import type { Metadata } from "next";
import { RingBadge } from "@/components/marketplace/ring-badge";

export const metadata: Metadata = { title: "Privacy", description: "How GoalKin handles your data (draft, pending legal review)." };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy notice</h1>
      <p className="text-sm text-muted">Last updated: [Effective date]. Controller: [Company legal name], [Company address]. Contact: [Privacy email].</p>
      <p>Short version: your goals are private by default, you decide exactly what each person sees, we use your data to run GoalKin for you, and we don&apos;t sell it.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account:</b> email, name you choose, sign-in method (email link, password, or Google sign-in).</li>
        <li><b>Goals and plans:</b> goal titles, why it matters, onboarding answers, approach and readiness answers, plan steps, check-ins, numbers you track, notes, photos and voice memos you add.</li>
        <li><b>People:</b> who you invite, circles you join, encouragement you send and receive.</li>
        <li><b>Settings:</b> tone, reminder times, time zone, theme.</li>
        <li><b>Purchases:</b> what you bought, the amount, and the order reference from our payment processor. We don&apos;t store card numbers.</li>
        <li><b>Usage:</b> basic events (like &ldquo;checked in&rdquo;) and which version of a feature you saw in a split test, to improve the product.</li>
      </ul>

      <h2 id="rings">Who sees your goals: the four rings</h2>
      <p>Every goal and every tracked number starts <b>Private</b>. Nothing is shared unless you choose it, and before anything is shared you see a preview of exactly what others will see.</p>
      <ul className="!list-none !pl-0 space-y-2">
        <li className="flex flex-wrap items-center gap-2"><RingBadge ring="private" /> Only you. The default for everything.</li>
        <li className="flex flex-wrap items-center gap-2"><RingBadge ring="chosen" /> People you pick one by one, like a partner or friend.</li>
        <li className="flex flex-wrap items-center gap-2"><RingBadge ring="circle" /> Members of a circle you put the goal in (and your chosen people).</li>
        <li className="flex flex-wrap items-center gap-2"><RingBadge ring="public" /> Anyone with your share link (and all the rings above).</li>
      </ul>
      <p>Each goal has a ring, and each number (status, percent, streak, plan, why, notes, photos and every tracked field) has its own switch. A wider ring always includes the narrower ones. Other people never get your raw data; they only get the filtered view you allowed.</p>

      <h2>How we use your data</h2>
      <ul>
        <li>To run GoalKin: build and show your plan, send the reminders you set, show your progress, share what you chose to share.</li>
        <li>To draft plans with AI: your goal and answers are sent to our AI provider [AI provider, e.g. Anthropic] to draft a plan. We don&apos;t send your name or email with it, and the provider may not use it to train its models under our agreement [confirm].</li>
        <li>To improve GoalKin: aggregate usage and split-test results.</li>
        <li>To handle purchases and support.</li>
      </ul>
      <p>Legal bases (where they apply): performing our contract with you, your consent (for example connecting Google Calendar or push notifications), and our legitimate interest in improving and securing the service.</p>

      <h2 id="google">Google Calendar</h2>
      <p>Connecting Google Calendar is optional. If you connect it, GoalKin asks only for permission to create and manage a separate calendar called &ldquo;Goals&rdquo; (the <code>calendar.app.created</code> scope). GoalKin can read and change only that calendar and the events it created there. It cannot see your other calendars or events.</p>
      <p>We use this access only to put your plan steps on your &ldquo;Goals&rdquo; calendar and keep them in sync when you move or finish them. GoalKin&apos;s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements. We don&apos;t use Google data for ads, don&apos;t sell it, and don&apos;t let humans read it except with your permission, for security, or where the law requires. You can disconnect at any time in Settings or in your Google account; we then delete the stored tokens.</p>

      <h2>Who we share data with</h2>
      <ul>
        <li>People you choose, through the rings above.</li>
        <li>Service providers who run GoalKin for us: hosting and database ([Hosting provider, e.g. Vercel] and our Supabase database at [Hosting location]), email delivery ([Email provider]), AI drafting ([AI provider]), and payments (GoHighLevel, our payment processor).</li>
        <li>Creators see sales totals for their templates, never buyers&apos; names or emails.</li>
        <li>Authorities, only when the law requires it.</li>
      </ul>
      <p>We don&apos;t sell your personal data or share it for targeted advertising.</p>

      <h2>Keeping and deleting your data</h2>
      <ul>
        <li>We keep your data while your account is open.</li>
        <li>You can delete a goal at any time; its plan, check-ins and numbers are deleted with it.</li>
        <li>You can delete your account in Settings or by emailing [Privacy email]. We delete your goals, check-ins, photos and settings within [30] days, except records we must keep by law (like purchase records for tax).</li>
        <li>You can ask for a copy of your data, or for corrections, at [Privacy email].</li>
      </ul>

      <h2>Security</h2>
      <p>Data is encrypted in transit. Goal data is protected by row-level security so only you can read your raw data, and shared views are filtered on our servers. No system is perfect; tell us at [Security email] if you find a problem.</p>

      <h2>Children</h2>
      <p>GoalKin is not for children under [minimum age]. If you think a child has given us data, contact us and we&apos;ll delete it.</p>

      <h2>Your rights</h2>
      <p>Depending on where you live (for example under GDPR or US state privacy laws), you may have rights to access, correct, delete or port your data, and to object or complain to a regulator. Email [Privacy email] and we&apos;ll respond within the time the law requires.</p>
    </>
  );
}
