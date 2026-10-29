# GoalKin — Template Marketplace

Status: draft v1 · 2026-10-29. Companion to `docs/PRD.md` §6. Prices and revenue shares here are proposals for owner review.

## 1. What the marketplace is

A library where people find a plan someone already proved, customize it in onboarding, and let the AI fit it to them. Three tiers:

| Tier | Made by | Price | Examples |
| --- | --- | --- | --- |
| Free | GoalKin | $0 | Bible in a year, first 5K, emergency fund |
| Premium | GoalKin and the Offer Factory catalog | Proposed $9 to $37, one-time | Finish the Year, New Year Reset, debt payoff |
| Creator | Coaches, pastors, club leaders, trainers | Set by the creator | Marathon plans, church small-group studies, club challenges |
| Advanced custom | The AI, from the person's own answers, optionally with a creator | Proposed premium add-on | A plan built from scratch for an unusual goal |

Buying a template adds it to the person's library; they can run it again any time.

## 2. Advanced custom templates

For goals the catalog doesn't cover, or people who want more depth:

1. **Start from a template or a blank goal.**
2. **Deeper interview.** 10 to 20 questions instead of 3 to 6: constraints, past attempts, what worked, resources, readiness, approach profile.
3. **AI drafts a full program:** phases, weekly benchmarks, daily actions, restart rules, milestone rewards, partner roles, and suggested add-on tracks.
4. **Person edits** anything, adds their own steps, removes what doesn't fit.
5. **Save as a personal template.** Optionally share it with a circle, or (for creators) submit it to the marketplace.

Creator-assisted option (later): a creator reviews and adjusts the AI draft for a fee they set.

## 3. Template file format

Every template is one JSON file validated by `templates/schema.json`. Core fields:

| Field | Purpose |
| --- | --- |
| `id`, `name`, `area`, `tier`, `price` | Catalog listing |
| `summary`, `duration` | What it is and how long it runs |
| `onboarding[]` | Questions: `id`, `prompt`, `type` (text, number, slider, choice, date, calendar_slots), `options`, `reaction` (playful reply line) |
| `plan_blueprint` | Phases and weekly benchmarks with variables filled from onboarding answers |
| `approach_variants` | How the plan changes for habit, willpower, time, reward and resource approaches |
| `tracked_fields[]` | Each field's `id`, `label`, `kind` (number, yes_no, rating, note, money, duration), `unit`, `default_visibility` |
| `guardrails[]` | Required steps and notices (doctor step, not-financial-advice line) |
| `restart_rules` | What happens after missed days |
| `addon_tracks[]` | Offer Factory products that can attach as guided tracks |
| `creator` | Creator id, revenue share, license |
| `price_log[]` | Every price set or changed, with basis |

`templates/catalog.json` holds the 44 launch templates in a lighter form; each becomes a full template file during production (SOP §3).

## 4. Creators

**Onboarding:** apply, verify identity and payout details, accept creator terms, publish a first template.

**Revenue share:** proposed 70% creator / 30% GoalKin on creator templates (owner decision).

**Review checklist before a template goes live:**
- Validates against the schema; plan generator produces realistic plans for three sample people.
- No medical, financial or guaranteed-result claims; health goals include the doctor step.
- Visibility defaults keep health and money numbers Private.
- Original content; the creator has the rights to everything in it.
- Price set; refund policy shown.

**Takedowns:** a reported template is hidden pending review; creators can appeal.

## 5. Discovery

- Browse by life area (Health, Wealth, Work and career, Relationships, Faith and spirit, Learning, Home, Giving).
- Filter by duration, tier, approach fit ("good for habit builders"), and solo vs group.
- Seasonal shelves: Finish the Year (Nov–Dec), New Year Reset (Jan), Lent, back-to-school, summer.
- Each listing shows a sample week, what's tracked and who sees it by default.

## 6. Data model additions

| Table | Holds |
| --- | --- |
| templates | Published template JSON, version, tier, price |
| template_versions | History; people keep the version they bought |
| purchases | Who bought what, price paid, payment reference |
| creators | Profile, payout details reference, revenue share |
| template_reviews | Ratings and written reviews from people who ran the template |
| custom_templates | A person's saved advanced custom templates |

## 7. Open decisions (owner)

- [ ] Creator revenue share (proposed 70/30).
- [ ] Price of advanced custom templates.
- [ ] Payment provider for marketplace payouts.
- [ ] Refund policy for templates (digital, instant delivery).
- [ ] Whether creators can sell subscriptions to group programs.
