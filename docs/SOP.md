# GoalKin — Standard Operating Procedure (SOP)

Status: draft v1 · 2026-10-29. Companion to `docs/PRD.md`. Agents do the build; the owner does only steps marked **Owner**.

## 1. Launch plan and timeline
The plan puts the Finish-the-Year program in market on Nov 20, which leaves 41 days to Dec 31, and opens New Year Reset sales on Dec 26. Agents do the build; the owner does only the steps marked **Owner**.

1. **Oct 29 to 31: decide and set up**
   - **Owner:** pick the app name and domain; approve the proposed prices.
   - Agents: create the repo, Supabase schema, Vercel project and Google Cloud project; write the privacy policy and terms on the app's domain.
2. **Oct 31 to Nov 3: file Google verification first** (it can take up to 10 days)
   - Agents: configure the OAuth consent screen with the narrow scope `calendar.app.created`, write the scope justification, record the demo video.
   - **Owner:** verify the domain in Google Search Console and press Submit in the Google Cloud console (sign-in required). Exact copy-paste steps are handed over at that point.
3. **Oct 29 to Nov 12: build the MVP**
   - Goal builder and templates, tracking modes, check-ins, reminders, tone modes.
   - Partners and groups with invite links, per-person visibility, encouragement notes.
   - Google Calendar sync into the app's own "Goals" calendar; calendar-feed (ICS) fallback for Apple and Outlook.
   - Share cards and finish certificates.
4. **Nov 13 to 19: private beta**
   - Up to 100 testers (Google's cap before verification) from existing email lists.
   - Fix what breaks; check every screen on phone and desktop.
5. **Nov 20: launch Finish-the-Year**
   - GoHighLevel funnel: sales page, order form with bump, one-click upsell and downsell, delivery email.
   - Catalog offers that sell accountability add a free month of Pro.
6. **Dec 1 to 25: build and pre-sell New Year Reset**
   - January templates, group challenges, leader cohort beta.
7. **Dec 26: open New Year Reset sales; program starts Jan 1, 2027.**
8. **January: Pro subscription live; Google Calendar side-panel add-on scoped** (desktop only, per Google).

**Added Oct 29 (owner's expanded scope):**

- [ ] Owner: confirm the name GoalKin and register goalkin.app; trademark search first.
- [ ] Create a dedicated GitHub repository and a separate build session for GoalKin, seeded with this doc.
- [ ] Build the approach profile and readiness check into onboarding; store each person's approach weights.
- [ ] Ship the 44-template catalog with the per-field visibility defaults above.
- [ ] Add the split-test framework (onboarding order, tone, reminder timing, first-week size) and the week-4 metric.
- [ ] Write terms and in-app notices for health and money plans; legal review before launch.
- [ ] Map Offer Factory products to add-on tracks inside goals.
- [ ] After MVP: native or wrapped phone app for notifications and watch mirroring; evaluate messaging-app channels.

## 2. How work runs in this repo
1. Every session starts by reading `TASKS.md`, restating the goal, and confirming the next step (see `CLAUDE.md`).
2. Work happens on a feature branch; each change ships as a pull request with tests and a passing build.
3. Secrets come from Infisical (project `75ce45d4-9209-45b0-a24d-a2078132f2f8`, env `prod`); never commit or print values.
4. Before ending a session, update `TASKS.md` with what is done, in progress, and next.

## 3. Template production (per template)
1. Pick the template from `templates/catalog.json` or a new idea; confirm its life area and tier.
2. Write the onboarding questions (3 to 6), each with an input type and a playful reaction line.
3. Define what the AI builds: phases, weekly benchmarks, calendar blocks, restart rules, and the approach-profile variants (habit, willpower, time, reward, resource).
4. Define tracked fields and the default visibility of each (health and money numbers start Private).
5. Add guardrail steps: health and diet goals include "talk to your doctor"; money goals carry "not financial advice"; every item stays editable.
6. Validate the template file against `templates/schema.json`, run it through the plan generator with three sample people, and read the three plans for realism.
7. Price it (Free, Premium $9 to $37 proposed, or Creator-set) and log the price and basis in the template file.
8. Publish to the catalog; add it to the landing page and the matching Offer Factory funnel where one exists.

## 4. Creator marketplace operations
See `docs/MARKETPLACE.md`: creator onboarding, review checklist, payouts, takedowns.

## 5. Quality bar for every release
- Phone first: check-in in one tap, under 10 seconds.
- Nothing shared without the owner choosing it; the share preview matches what others see.
- Light and dark themes, readable at 200% zoom, screen-reader labels.
- No medical, financial or results claims; suggestions are labeled; affiliate links disclosed.
