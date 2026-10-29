# TASKS — GoalKin

> Durable project memory. Every session reads this first, restates the goal, shows the to-do, and confirms the next step.

## Goal
Ship GoalKin: Finish-the-Year program live by Nov 20, 2026; New Year Reset sales open Dec 26; template marketplace with creator templates after MVP.

## To-do
- [x] Market scan, PRD, SOP, marketplace spec, template catalog (docs/, templates/)
- [x] Brand: logo concepts, word art with calendar "o", landing page draft (brand/)
- [ ] Owner: register goalkin.app (trademark search first)
- [x] Owner interview: owner chose full scope, built at once (Q1). Q2–Q7 use the recommended defaults, recorded in docs/DECISIONS.md and pending owner review
- [~] App built on branch feature/goalkin-app, draft PR https://github.com/rtmendes/goalkin/pull/1 (typecheck, lint, 160 tests and build pass). Migration supabase/migrations/0001 NOT applied yet: waiting on owner approval, then run scripts/seed-templates.mjs
- [~] Goal builder, check-ins, tone modes, reminders (email, web push)
- [~] Visibility levels + per-field switches + share preview
- [~] Circles: invites, shared goal with member layers
- [~] Google Calendar sync (own "Goals" calendar, calendar.app.created scope) + ICS feed; file OAuth verification early
- [~] AI plan builder using templates/schema.json + approach profile + readiness check
- [x] Convert the 44 catalog templates into full template files, plus Finish the Year and New Year Reset programs (46/46 pass scripts/validate-templates.mjs)
- [~] Marketplace: listings, purchases, creator onboarding, review checklist (docs/MARKETPLACE.md)
- [~] Focus rooms (shared Pomodoro)
- [~] Split-test framework + week-4 metric
- [~] Terms and notices drafted (/legal/*, with placeholders); legal review still needed

## Next step
1. Owner approves applying the migration to the shared Supabase; then apply it and seed the templates.
2. Set the missing env vars on Vercel (see PR #1 "Needed before launch"), deploy a preview, and run the private beta checklist (SOP §1 step 4) on phone and desktop.
3. File the Google OAuth verification (calendar.app.created) now; it can take up to 10 days.
4. Owner reviews docs/DECISIONS.md #2–#11 (defaults used without interview).

## Blocked on
- Domain purchase and name confirmation (owner).
- Owner approval to apply supabase/migrations/0001_goalkin_core.sql to the shared self-hosted Supabase (it only adds new gk_* tables, a gk-media storage bucket and its policies).
- No email-sending key in Infisical (RESEND_API_KEY); email reminders are skipped until one exists.
- GoHighLevel checkout URLs (GK_CHECKOUT_*) and GHL_WEBHOOK_SECRET.
- Vercel Pro (or an outside scheduler) for the 15-minute reminder cron.

Last updated: 2026-10-29 (build session on branch feature/goalkin-app)
