# TASKS — GoalKin

> Durable project memory. Every session reads this first, restates the goal, shows the to-do, and confirms the next step.

## Goal
Ship GoalKin: Finish-the-Year program live by Nov 20, 2026; New Year Reset sales open Dec 26; template marketplace with creator templates after MVP.

## To-do
- [x] Market scan, PRD, SOP, marketplace spec, template catalog (docs/, templates/)
- [x] Brand: logo concepts, word art with calendar "o", landing page draft (brand/)
- [ ] Owner: register goalkin.app (trademark search first)
- [x] Owner interview: owner chose full scope, built at once (Q1). Q2–Q7 use the recommended defaults, recorded in docs/DECISIONS.md and pending owner review
- [~] Scaffold app: Next.js 16 + Supabase schema written (supabase/migrations/0001); migration NOT yet applied, waiting on owner approval
- [~] Goal builder, check-ins, tone modes, reminders (email, web push)
- [~] Visibility levels + per-field switches + share preview
- [~] Circles: invites, shared goal with member layers
- [~] Google Calendar sync (own "Goals" calendar, calendar.app.created scope) + ICS feed; file OAuth verification early
- [~] AI plan builder using templates/schema.json + approach profile + readiness check
- [~] Convert the 44 catalog templates into full template files (SOP §3); first done: templates/full/bible-in-a-year.json
- [~] Marketplace: listings, purchases, creator onboarding, review checklist (docs/MARKETPLACE.md)
- [~] Focus rooms (shared Pomodoro)
- [~] Split-test framework + week-4 metric
- [ ] Terms and notices; legal review

## Next step
Merge the parallel build branches into feature/goalkin-app, verify (typecheck, tests, build), open a draft PR, then apply the migration once the owner approves.

## Blocked on
- Domain purchase and name confirmation (owner).
- Approval to apply supabase/migrations/0001_goalkin_core.sql to the shared self-hosted Supabase (it only adds new gk_* tables, a gk-media storage bucket and its policies).
- No email-sending key in Infisical (RESEND_API_KEY); email reminders are skipped until one exists.
- GoHighLevel checkout URLs (GK_CHECKOUT_*) and GHL_WEBHOOK_SECRET.

Last updated: 2026-10-29 (build session on branch feature/goalkin-app)
