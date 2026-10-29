# GoalKin — Product Requirements (PRD)

Status: draft v1 · 2026-10-29 · owner: Rashida Mendes
Source: the planning doc "Accountability App: Market Scan, PRD, SOP & Tech Stack" (full export in `docs/plan-doc-export-2026-10-29.md`).
Name: GoalKin (domain to register: goalkin.app; trademark search pending). Brand assets: `brand/`.

## 1. Summary
**Build it.** The open spot in the market is accountability that lives on the user's calendar, works solo or with invited partners, and lets each person set the tone. No product we checked does all three; the closest ones each miss the calendar (see Market scan).

- **Why now:** 64 days remain in 2026 as of today. Finish-the-Year runs now to Dec 31, then New Year Reset runs in January, the year's peak for goal-setting.
- **Recommendation:** ship a web app first (works on any phone), with Google Calendar sync through its own "Goals" calendar and a calendar-feed fallback. A Google Calendar side-panel add-on comes later, because Google says Calendar add-ons don't run on mobile.
- **How it earns:** a low-price Finish-the-Year and New Year program as the front end, with a paid subscription for partners, groups and tone modes (see Positioning and offer).
- **Biggest risk to the date:** Google's OAuth verification for calendar access. It is capped at 100 users until verified and can take up to 10 days, so it is filed first (see SOP).

## 2. Positioning and offer
The app wins on one line: **your goal, on your calendar, with someone in your corner, in the tone you choose.** It is the only option that combines the calendar placement of Reclaim, the partner layer of Habit Huddle and the consequences of stickK, with per-person privacy.

**Who buys first**

- People finishing a 2026 goal before Dec 31 (a project, a fitness target, a book, a launch).
- People setting a 2027 resolution, alone or with a spouse, friend or small group.
- Group leaders already in our catalog's audiences: coaches, church small groups, creators running a challenge.

**Offer ladder (proposed prices, for owner review)**

Prices are anchored to verified competitors: Habitica $4.99/mo, Beeminder and Focusmate $8/mo, Supporti $15.99/mo, GoalsWon $90/mo.

| Step | What it is | Proposed price | Notes |
| --- | --- | --- | --- |
| Free | One solo goal, calendar sync, gentle tone | $0 | Email capture; the share card drives invites |
| Finish-the-Year or New Year Reset program | Guided 30 to 60-day program, templates, all tone modes, 1 partner | $37 one-time | Matches the catalog's $37 front-end tier; sold through the GoHighLevel funnel with bump, upsell and downsell |
| Pro | Unlimited goals, partners and groups, consequences, recaps | $9/mo or $79/yr | Between Beeminder and Supporti |
| Leader | Run cohorts up to 50, group dashboard, branded program | $29/mo | Later tier, after MVP |

**How it plugs into the Offer Factory**

- Many catalog offers already sell accountability as a bump or upsell (for example The Accountability Pod System, The 30-Day Discipline Challenge, The Accountability Partner Kit). Each can give buyers a free month of Pro, so the app becomes the delivery layer for those offers.
- Every program finish produces a shareable certificate, which brings in the next buyer.

## 3. Core product (MVP)
The product is a goal-accountability app that puts each goal's weekly plan, benchmarks and check-ins on the user's own calendar, works solo or with invited partners, and lets each person choose the tone. Working name: **Accountability App** (name to be chosen).

#### Who it is for

- **Solo achiever:** wants one goal finished (a project, a fitness target, a habit) and keeps losing track after week two.
- **Pair:** two people holding each other to separate goals (friends, spouses, coworkers).
- **Small group or pod:** 3 to 8 people on a shared challenge (a 30-day reset, a year-end sprint, a book club).
- **Leader:** a coach, pastor, team lead or community owner running a group program; later a paid tier.

#### Jobs to be done

1. Turn a vague goal into a weekly plan with visible benchmarks.
2. See the plan where the day is already planned: the calendar.
3. Be checked on, and check on others, without nagging.
4. Make progress visible, including progress that is not a hard number.
5. Keep going after a missed day instead of quitting.

#### Core features (MVP)

| Area | What it does | Notes |
| --- | --- | --- |
| Goal builder | Goal, why, finish date, weekly benchmarks, the actions that move it, notes | Templates: fitness, finish a project, habit, money, faith, learning, custom |
| Tracking modes | Numbers (reps, pages, dollars), yes/no, 1-to-5 self-rating, or a short reflection | The user picks per goal; "more casual" goals never require numbers |
| Calendar sync | Writes planned sessions and weekly check-ins into Google Calendar; check-in link in each event | Also a subscribe-able calendar feed for Apple/Outlook users |
| Check-ins | Daily or weekly prompt: done / partly / missed, plus a note or photo | One tap from a reminder |
| Reminders | Scheduled ahead, per goal, by email, push and calendar alert; quiet hours | Frequency set by tone mode |
| Partners and groups | Invite by link or email; solo, pair or group | Each invite states what will be shared |
| Visibility controls | Per goal and per person: private, summary only (on track / behind), or full detail | Default is summary only |
| Encouragement | Notes, reactions and short voice or video notes between members | Templates for what to say when someone misses |
| Consequences and stakes | Optional: a self-set consequence, a partner-set dare, or a pledge to a cause | Money stakes are a later tier and need legal review |
| Tone modes | Gentle, Coach, Drill Sergeant, Playful; changes reminder wording, frequency and summary style | Set per goal and per group |
| Progress view | Weekly scorecard, streaks with a missed-day recovery rule, benchmark chart | Shareable image card |
| Sharing | Share a goal card, weekly recap or finish certificate to social or a group link | No account needed to view |
| Seasonal programs | Finish-the-Year (Nov to Dec 31) and New Year Reset (Jan 1 to 31) templates | Ties into Offer Factory funnels |

#### Later (after MVP)

- Group leader dashboard, cohorts and paid programs.
- Money stakes, with legal and payment review first.
- Integrations: Apple Health and Google Fit steps, Strava, Notion, Todoist.
- An AI coach that drafts the weekly plan and the recap in the chosen tone.
- A Google Calendar add-on side panel (see Tech stack for platform limits).

#### Requirements that hold for every feature

- Nothing is shared without the owner choosing it; every share shows exactly what others will see.
- Works on a phone first: check-in in one tap, under 10 seconds.
- Missing a day never deletes progress; the app offers a restart plan.
- Health goals carry an "education, not medical advice" line; no health claims.
- Accessibility: readable at 200% zoom, screen-reader labels, no colour-only meaning.

#### How we will know it works

- Week-4 retention of people who set a goal.
- Share of goals with at least one partner.
- Check-ins per active user per week.
- Goals marked finished by their date.

Targets for these are an open decision (see Risks and open decisions).

## 4. Platform expansion
The app grows from a calendar tracker into **Goal Witness**: a personal accountability platform with AI-built plans, a template marketplace, and layered sharing, where each person decides exactly who sees what. It is for life outside work: fitness, faith, money, learning, relationships, causes.

#### Visibility: four levels, plus a toggle per field

| Level | Who sees it | Example |
| --- | --- | --- |
| Private | Only me | Weight, journal notes |
| Chosen people | Named individuals | My spouse sees my budget goal |
| Circle | A group I belong to | My running club sees my training miles |
| Public | Anyone with the link, or the community feed | My charity marathon fundraising page |

Every goal keeps full detail for its owner. Each field (KPIs, hours, money, notes, photos, % complete) has its own toggle, so a person can show "on track, 72%" to a circle while keeping the numbers behind it private. Default is Private.

#### Shared goals with private layers

A circle can hold one shared goal while each member tracks their own measures under it. Example: a running club's shared goal is "everyone finishes the city marathon". One member also tracks weight loss (private), another tracks charity money raised (public), and a third tracks training hours (circle only). The club sees the shared progress; each person controls their own layer.

#### Tracking depth: the person picks

- **Detailed:** KPIs, hours spent, money earned or raised, % to goal, streaks.
- **Simple:** done / partly / missed, or a 1 to 5 rating.
- **Reflective:** a short note on what moved them forward, no numbers.

#### AI plan builder

The person states a goal and a few facts; the AI drafts a dated plan with weekly benchmarks they can edit, then places it on their calendar. Examples:

- **Marathon:** race date, current weekly miles, injuries, days available, then a week-by-week plan with long runs, rest days and taper. Health goals carry an "education, not medical advice; check with a clinician" line.
- **Read the Bible in a year:** start date, reading time per day, preferred order (canonical, chronological, Old and New Testament together), then daily readings with catch-up days and a progress benchmark each month.
- **Others:** finish a book, pay off a debt, launch a side project, a 30-day faith or wellness reset.

#### Template marketplace

| Template type | Price | Source |
| --- | --- | --- |
| Starter templates | Free | Goal Witness |
| Premium programs (Finish-the-Year, New Year Reset, marathon, Bible in a year) | Proposed $9 to $37 each | Goal Witness and the Offer Factory catalog |
| Creator templates | Set by the creator | Coaches, pastors, club leaders; Goal Witness keeps a share (proposed 20 to 30%) |

Offer Factory products that sell a plan or challenge can ship as a Goal Witness template, so every buyer gets the app as the delivery layer.

#### Together time

- **Focus rooms:** timed Pomodoro sessions (for example 25 on, 5 off) that partners or a circle join together, with a shared timer and a check-in at the end.
- **Circle meetups:** scheduled group check-ins added to everyone's calendar, with the circle's progress shown.
- **Encouragement:** notes, reactions and voice notes, with templates for what to say after a missed week.

#### Plans and pricing (proposed, for owner review)

| Plan | Who | Proposed price |
| --- | --- | --- |
| Free | One solo goal, starter templates, private only | $0 |
| Pro | Unlimited goals, all visibility levels, AI plan builder, focus rooms | $9/mo or $79/yr |
| Circle | A leader runs a group of up to 25: shared goals, member layers, meetups | $29/mo |
| Club | Up to 250 members, branded page, sells its own templates | $99/mo |
| Templates | Premium programs, one-time | $9 to $37 each |

How these plans add up to a few hundred thousand dollars depends on conversion and retention numbers we don't have yet; set targets after the November beta (see Open decisions).

#### Brand

Palette: Ink Navy #14213D, Champagne Gold #C9A86A, Ember Coral #FF6B4A, Steady Sage #2F7D6D, Ivory #F7F3EC. Type: Playfair Display (headings), Nunito Black (playful word art), Inter (app). Logo concepts are in the owner's files (goal-witness-logo-concepts.png). Domain to register: goalwitness.com (available Oct 28, $11.25/yr); trademark search first.

&#91;image: Goal Witness logo concepts A, B and C with the brand palette\]

**GoalKin version (Oct 29):** same mark and palette with the GoalKin name; the gold ring is "your kin".

&#91;image: GoalKin logo concepts A, B and C with the brand palette\]

**GoalKin word art, calendar "o" (owner request, Oct 29):** the "o" in goal is the calendar badge, so the app's calendar idea lives inside the name.

&#91;image: GoalKin word art where the o is a calendar the height of the letter a, with a green top, gold rings and a coral check\]

## 5. Personalization engine
GoalKin's core IP is fitting the plan to how each person actually gets things done. People respond to different methods; the app learns which one fits, builds the plan in that style, and keeps testing what works.

#### Approach profile: five short questions in onboarding

| Approach | Who it fits | How the plan changes |
| --- | --- | --- |
| Habit builder | Likes routines and streaks | Tiny daily actions stacked on existing habits, streak tracking |
| Willpower and challenge | Likes a hard push and a finish line | Bold targets, countdowns, Drill Sergeant tone, dares from partners |
| Time manager | Lives by the calendar | Every action is a calendar block; weekly review of time spent |
| Reward driven | Motivated by what they earn | Rewards they choose at each milestone, points, unlockable treats |
| Resource planner | Stalls on "I don't have what I need" | Plan starts with gathering money, tools, people and skills, then the doing |

Many people are a mix; the profile stores a weight for each approach, and the AI blends them.

#### Readiness check

Before building the plan, the app asks how ready the person is (time, energy, money, support, competing goals) and what has to move out of the way first. Low readiness produces a smaller first phase and a "clear the path" step list, so the plan is realistic instead of aspirational.

#### Getting through the hard weeks (support tools, no claims)

- Missed-day restart plans instead of broken streaks.
- "Why it matters" photo or voice memo shown on hard days.
- If-then plans written in advance ("If I miss Tuesday, I run Wednesday at 6").
- Encouragement templates for partners, and a nudge when a partner goes quiet.
- Reflection prompts at each milestone.

These are presented as tools to try, with no promises of results and no clinical or therapeutic claims.

#### Split tests built in

The app can A/B test onboarding order, approach blends, tone, reminder timing and channel, and first-week size. Each test reports week-4 check-in rate and goals finished, so the default plan improves over time.

#### Health and money guardrails

- Health plans add a step: "Talk to your doctor before starting" for any medical, weight, diet or supplement goal. The person completes it; GoalKin does not give medical advice.
- Suggestions such as meal plans, supplements or products are labeled as suggestions, with affiliate links disclosed, and never presented as treatment.
- Every plan item can be edited, removed, or added by the person. The AI drafts; the person decides.
- Terms and in-app notices state that plans are suggestions and the person is responsible for their own choices. Legal review of these terms before launch.

#### Reminders where the person already looks

| Channel | Status |
| --- | --- |
| Calendar events (Google; ICS feed for others) | In MVP |
| Email | In MVP |
| Web push on phone and desktop | In MVP |
| Phone app notifications, including watch mirroring | Needs a native or wrapped app; after MVP |
| Messaging apps (for example WhatsApp, Telegram, Messenger, Slack, Discord) | To evaluate; each has its own business messaging rules and approval |
| SMS | Optional later; owner prefers other channels |

The person picks channels and quiet hours per goal.

#### Cross-sell and coaching tracks

Offer Factory products (productivity, business, faith, wellness) become add-on tracks inside a goal. Example: a "Launch a side project" goal can attach the matching business kit as a guided track. Each track stays personalized to the person's approach profile, and buying one adds it to their template library.

#### Related app: LifeLegacy HQ

LifeLegacy HQ (end-of-life planning with loved ones, kept warm rather than grim) already has its own repository, [rtmendes/lifelegacy](https://github.com/rtmendes/lifelegacy), with a logged-out preview of its dashboard, vault, documents, plan, templates, checklist and family pages. GoalKin's circles, visibility levels and guided templates could power its family planning features later; it stays a separate product.

## 6. Template catalog and onboarding
The machine-readable catalog is `templates/catalog.json` (44 templates). The marketplace and the template format are specified in `docs/MARKETPLACE.md`.

GoalKin launches with 44 templates in eight life areas. Each one asks a few playful questions, lets the person set who sees each number, and hands the answers to the AI, which builds a dated plan on their calendar. Health and money numbers default to Private; progress percentage defaults to the goal's circle.

**Visibility key:** P = Private (only me) · C = Chosen people · Ci = Circle · Pub = Public. Every field can be switched on or off after setup.

**Tier key:** Free = starter template · Premium = paid program (proposed $9 to $37) · Creator = made and priced by a coach, pastor or club leader.

#### Health

| Template | Onboarding inputs | AI builds | Tracks | Default visibility | Tier |
| --- | --- | --- | --- | --- | --- |
| First 5K / 10K | Race date or "no race yet"; runs per week now; longest recent run; days free | Walk-run or run plan by week, rest days, race-week taper | Runs done, distance, longest run | Distance Ci; pace P | Free |
| First marathon | Race date; weekly miles now; injuries; long-run day | 16 to 20-week plan with long runs, cutback weeks, taper | Weekly miles, long run, missed runs | Miles Ci; weight P | Creator |
| Steady weight change | Target change and date; current routine; foods you won't give up | Weekly habit targets (meals, steps, sleep), not crash rules | Habits hit, weigh-ins (optional) | Weight P; habits C | Premium |
| Strength 3× a week | Equipment at home or gym; experience; minutes per session | Progressive routine, which days, deload weeks | Sessions, lifts, minutes | Sessions Ci; lifts P | Free |
| Sleep reset | Bedtime now; wake time needed; screens in bed | Wind-down routine, light and caffeine cutoffs, 14-night ramp | Bedtime, wake time, how rested 1 to 5 | All P | Free |
| Daily steps | Average steps now; target; walk buddy? | Weekly step ramp, walk slots on calendar | Steps per day | Steps Ci | Free |
| Alcohol-free month | Start date; usual drinking nights; social events coming | Night-by-night plan, swap drinks, event scripts | Alcohol-free days, cravings 1 to 5 | Streak C; notes P | Premium |

Health templates carry "education, not medical advice; check with your clinician" in the plan and on the share card.

#### Wealth

| Template | Onboarding inputs | AI builds | Tracks | Default visibility | Tier |
| --- | --- | --- | --- | --- | --- |
| Emergency fund | Target amount (or months of expenses); monthly room to save; payday | Auto-transfer schedule, milestone dates | Amount saved, % to target | Amount P; % C | Free |
| Debt payoff | Each debt's balance, rate, minimum; extra per month | Payoff order (smallest first or highest rate first, user picks), payoff dates | Balance per debt, debts closed | Balances P; debts closed C | Premium |
| Save for a big goal | What (trip, car, down payment); amount; deadline | Monthly target, cut-or-earn options to close the gap | Saved, % to goal | % Ci; amount P | Free |
| No-spend month | Start date; categories off-limits; allowed spending | Daily check-in, swap ideas, end-of-month review | No-spend days, money kept | Streak Ci; amounts P | Free |
| First $1,000 of side income | Skill or idea; hours per week; deadline | First offer, first 10 people to ask, weekly targets | Asks made, sales, income | Asks Ci; income P | Premium |
| Year-end money review | Accounts to check; household members | Two-session review agenda, next-year targets | Sessions done, targets set | All C (partner) | Free |

#### Work and career (personal growth, outside any employer's tools)

| Template | Onboarding inputs | AI builds | Tracks | Default visibility | Tier |
| --- | --- | --- | --- | --- | --- |
| Career switch | Current role; target role; hours per week; deadline | Skill gaps, portfolio pieces, outreach targets by week | Applications, conversations, pieces done | Counts C; target companies P | Premium |
| Ask for a raise | Current pay (optional); review date; wins so far | Evidence log, rehearsal sessions, the ask script | Wins logged, rehearsals | All P | Premium |
| Launch a side project | The idea; launch date; hours per week | Milestones from idea to first customer | Milestones, hours | Milestones Pub; hours Ci | Free |
| Learn a skill or certification | Skill; exam or demo date; study time | Study schedule, practice tests, review days | Hours, practice scores | Hours Ci; scores P | Free |
| Finish the book | Target words; deadline; writing days | Weekly word targets, revision stop rule | Words, sessions | Streak Ci; words C | Free |
| Deep work habit | Best hours; distractions; focus goal per week | Focus blocks on calendar, focus-room invites | Focus hours, rounds | Hours Ci | Free |

#### Relationships

| Template | Onboarding inputs | AI builds | Tracks | Default visibility | Tier |
| --- | --- | --- | --- | --- | --- |
| Weekly date night | Budget per date; nights free; what you both enjoy | A year of date ideas by season, calendar holds | Dates done, how it felt 1 to 5 | All C (partner) | Premium |
| Phone-free family dinners | Nights per week; ages of kids; who cooks | Rotation, conversation prompts by age | Dinners held | Count Ci (family) | Free |
| Reconnect with friends | Names (optional); how often; preferred way (call, coffee) | Rotation so no one goes 30 days without contact | Contacts made | All P | Free |
| Co-parenting rhythm | Schedule pattern; shared decisions; tone | Handoff checklist, monthly check-in agenda | Check-ins held | All C (co-parent) | Creator |
| Hard conversation prep | Who; topic; deadline | Prep steps, opening lines, follow-up plan | Steps done | All P | Premium |
| Acts of service | Who to serve; time per week | Weekly idea list, calendar reminders | Acts done | Count Ci | Free |

#### Faith and spirit

| Template | Onboarding inputs | AI builds | Tracks | Default visibility | Tier |
| --- | --- | --- | --- | --- | --- |
| Bible in a year | Start date; minutes per day; canonical or chronological; translation | Daily readings, catch-up days, monthly benchmark | Chapters read, % of plan | % Ci; notes P | Free |
| Prayer rhythm | Times of day; prayer list topics; with family? | Daily prompts, weekly theme, answered-prayer log | Days prayed | Streak C; list P | Free |
| Scripture memory | Verses or theme; verses per week | Review schedule with spaced repetition | Verses memorized | Count Ci | Free |
| Sabbath and rest | Rest day; what rest means to you | Prep checklist the day before, rest-day plan | Rest days kept | All P | Free |
| Gratitude journal | Time of day; prompt style | 30 or 90 days of prompts | Entries | All P | Free |

#### Learning and growth

| Template | Onboarding inputs | AI builds | Tracks | Default visibility | Tier |
| --- | --- | --- | --- | --- | --- |
| Read 24 books | Genres; reading time; current book | Monthly picks, pages per day | Books, pages | Books Pub; pages Ci | Free |
| Learn a language | Language; level now; minutes per day; trip date | Daily practice mix, speaking sessions | Minutes, words learned | Minutes Ci | Premium |
| Daily journal | Time; style (prompts or free) | Prompts by week | Entries | All P | Free |
| Screen-time reset | Daily hours now; target; apps that pull hardest | Step-down plan by week, swap activities | Screen hours | Hours C | Premium |

#### Home and life

| Template | Onboarding inputs | AI builds | Tracks | Default visibility | Tier |
| --- | --- | --- | --- | --- | --- |
| Declutter the house | Rooms; time per session; deadline | Room-by-room schedule, donate runs | Rooms done, bags out | Rooms Ci | Free |
| Meal prep rhythm | People fed; cooking nights; diet needs | Weekly menu, shopping list, prep day | Meals cooked | All C | Free |
| Home project | Project; budget; deadline; helpers | Tasks in order, supply list, helper invites | Tasks done, spent | Tasks Ci; spent P | Free |
| Holiday plan | Events; gift list; budget | Week-by-week tasks to Dec 31 | Tasks done, spent | Tasks C; spent P | Premium |

#### Giving and community

| Template | Onboarding inputs | AI builds | Tracks | Default visibility | Tier |
| --- | --- | --- | --- | --- | --- |
| Charity fundraiser | Cause; target amount; event date | Ask schedule, update posts, thank-you list | Raised, donors | Raised Pub | Free |
| Volunteer hours | Where; hours target; months | Monthly schedule | Hours | Hours Pub | Free |
| Club challenge | Club; shared goal; dates; member layers | Shared plan plus each member's own targets | Shared %, member layers | Shared Ci; layers per member | Creator |
| Small group study | Group size; weeks; meeting day | Session plan, leader prompts, reminders | Sessions held, attendance | All Ci | Creator |
| Mentor someone | Who; how often; focus | Session agendas, check-in rhythm | Sessions | All C | Free |
| Neighborhood project | Project; helpers; date | Task list, sign-up roles, reminders | Tasks, helpers | All Pub | Free |

#### Onboarding flow (about 3 minutes, every step skippable)

1. **Pick your arena.** Swipe through eight colorful cards (Health, Wealth, Work, Relationships, Faith, Learning, Home, Giving) and tap one or two.
2. **Say it in one sentence.** Type or speak the goal ("Run my first half marathon in April"). The AI offers three sharper versions to pick from.
3. **Where are you now.** Sliders and quick taps for the template's inputs, with a fun reaction on each ("15 miles a week? That's a real base.").
4. **Your week.** Tap open slots on a mini calendar; the plan only uses the time you give it.
5. **Pick your tone.** Gentle, Coach, Drill Sergeant or Playful, each with a sample reminder so the person hears the voice before choosing.
6. **Who's in your corner.** Invite by link or name, then drag each number into Private, Chosen people, Circle or Public. A live preview shows exactly what each person will see.
7. **Why it matters.** Optional photo, short note or voice memo shown on hard days.
8. **Watch the plan build.** The AI lays out weeks on screen, then the first two weeks appear on the calendar. Everything stays editable.
9. **First win today.** A two-minute starter action so day one ends with a check mark.

Catalog counts: Health 7, Wealth 6, Work and career 6, Relationships 6, Faith and spirit 5, Learning 4, Home 4, Giving 6 = 44 templates.

## 7. Tech stack and architecture
One web app on Vercel, backed by the self-hosted Supabase the company already runs, writes each goal's plan to the user's calendar and sends reminders. This follows the org standard (Supabase, Vercel, self-hosted where possible) and needs no new vendor for the MVP.

&#91;embedded content: architecture · web app, database, three outbound channels\]

The calendar sync worker writes only to a calendar the app creates, and Google's push notifications plus a periodic re-sync keep it current both ways.

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js web app on Vercel, installable as a PWA | One codebase for phone and desktop; no app-store review before the holiday window |
| Database, login, live updates, files | Supabase (Postgres, Auth, Realtime, Storage) on the existing server | Already run by the company; row-level security enforces per-person visibility |
| Google Calendar | Calendar API with the `calendar.app.created` scope: the app creates its own "Goals" calendar and writes only there | Narrowest scope Google lists for this; Google asks apps to justify anything broader ([scopes](https://developers.google.com/workspace/calendar/api/auth)) |
| Change tracking | Calendar `watch` push channels, renewed by the app, plus a periodic re-sync | Google says channels don't auto-renew and notifications are "not 100% reliable" ([push guide](https://developers.google.com/workspace/calendar/api/guides/push)) |
| Other calendars | ICS subscription feed per user | Works with Apple, Outlook and Google without sign-in; read-only and slow to refresh |
| Reminders | Scheduler job sending email and web push with one-tap check-in links | Tone mode sets wording and frequency |
| Payments | GoHighLevel checkout; a purchase webhook unlocks the program or Pro | Same checkout as the rest of the catalog |
| Later | Google Calendar side-panel add-on | Desktop only: Google states Calendar add-ons don't run on mobile ([add-ons](https://developers.google.com/workspace/add-ons/calendar)) |

**Core data model**

| Table | Holds |
| --- | --- |
| profiles | Person, time zone, default tone |
| goals | Goal, why, finish date, tracking mode, tone, template |
| benchmarks | Weekly targets per goal |
| check\_ins | Date, status (done / partly / missed), value, note, photo |
| circles | A pair or group, its program and tone |
| circle\_members | Who is in a circle and their role |
| visibility\_rules | Per goal and per member: private, summary or full |
| encouragements | Notes, reactions, voice notes between members |
| consequences | Self-set or partner-set consequence per goal |
| reminders | Schedule, channel and quiet hours per goal |
| calendar\_links | Google calendar id, watch channel, ICS token |

## 8. Risks and open decisions
| Risk | Effect | Fallback |
| --- | --- | --- |
| Google OAuth verification takes the full 10 days or asks for changes | Calendar sync capped at 100 users at launch | Launch with the calendar-feed (ICS) option for everyone; switch on two-way sync when verified |
| Calendar-feed refresh is slow (third parties report up to 12 hours, sometimes 48) | Feed users see changes late | Feed carries the fixed plan; check-ins and partner updates happen in the app |
| Push notifications from Google are "not 100% reliable" | Missed calendar edits | Periodic re-sync job, as Google's push guide advises |
| Calendar add-ons don't run on mobile | Side panel helps desktop users only | Web app is the main surface; add-on is a later extra |
| Money stakes (stickK style) bring payment and legal questions | Delay | MVP uses self-set and partner-set consequences only |
| Partners drift away (the market's top complaint) | Churn | Tone modes, missed-day recovery plans, and a nudge when a partner goes quiet |

**Open decisions for the owner**

- [ ] App name and domain
- [ ] Approve or change the proposed prices ($37 program, $9/mo or $79/yr Pro, $29/mo Leader)
- [ ] Targets for week-4 retention and finished goals
- [ ] Whether personal @gmail.com users can install the future Calendar add-on (Google's docs don't say; test before relying on it)

## Appendix A. Market scan (2026-10-28)
No product we checked puts goals, accountability partners and consequences inside the user's calendar. Calendar tools schedule time but have no social layer; accountability tools have no calendar presence. Facts below come from each product's own site, help center or App Store listing; anything unconfirmed is marked "not verified".

| Product | How accountability works | Calendar | Tone | Price | Gap it leaves |
| --- | --- | --- | --- | --- | --- |
| [Cura Contracts](https://curacontracts.cc/winterarc) (2026 beta) | Signed goal "contracts"; Winter Arc runs sign-up to Dec 31; partner co-sign and nudges; 2 missed days = "BROKEN" | None (Apple Health / Health Connect steps) | Hard-core | Free beta | No calendar, notes, benchmarks or per-member visibility |
| [Habit Huddle](https://habithuddle.com/) (2026) | Group "huddles", cheers, nudges, seasons, leaderboards, floor/ceiling targets; misses hidden | In-app only | Playful | Free to start; paid not listed | No external calendar, no real consequences |
| [Beeminder](https://www.beeminder.com/premium) | Data goals on a "red line"; pledges climb $0 to $270 when you derail | Zapier/IFTTT workarounds only | Hard-core, nerdy | Free; $8, $16, $81/mo | Solo only; no groups or warmth |
| [stickK](https://www.stickk.com/) | Money-stake contracts, Referee and Supporters | Not verified | Hard-core | Free; [$5 per staked contract](https://stickk.zendesk.com/hc/en-us/articles/24859287962003-Understanding-the-New-5-Commitment-Creation-Fee) | Dated UI, no reminders in calendar |
| [Focusmate](https://www.focusmate.com/pricing) | Live 25/50/75-min video sessions with a stranger | [One-way session sync](http://support.focusmate.com/en/articles/9524081-google-calendar-integration-calendar-notification-emails) | Calm | Free 3/week; $8/mo yearly | Sessions only; no goals or programs |
| [Supporti](https://www.getsupporti.com/help) | 1:1 stranger match for 7 days, daily reports | Not mentioned | Supportive | $15.99/mo | Strangers only; store pages returned 404 |
| [GoalsWon](https://www.goalswon.com/) | Human coach replies to a daily check-in | Not stated | Coaching | $90/mo | Expensive; no peers |
| [HabitShare](https://habitshareapp.com/) | Friends; habits private by default, per-habit sharing | Not mentioned | Friendly | Free | Habits only |
| [Habitica](https://habitica.com/static/plans) | Parties, guilds, challenges | Not verified | RPG game | $4.99/mo; group $9/mo + $3/member | Reviews: "messy", crashes |
| [Strides](https://www.stridesapp.com/) | Target pace lines, milestones; partners via iCloud | Not mentioned | Clean | $39.99/yr | Partners work on Apple devices only |
| [Griply](https://griply.app/pricing) | Goals, subgoals, habits; no sharing | Shows Google/Outlook events | Calm | Free 2 goals; $49.99/yr | No social side |
| [Reclaim.ai](https://reclaim.ai/pricing) | Habits auto-scheduled and protected in Google Calendar | Yes, core feature | Productivity | Free; $10 to $22/seat/mo | No partners, stakes or encouragement |
| [Motion](https://www.usemotion.com/pricing), [Sunsama](https://www.sunsama.com/pricing), [Akiflow](https://akiflow.com/pricing) | Planning only | Google sync | Productivity | $17 to $34/mo | No goals or accountability |

**What the market is missing**

1. **Accountability where the schedule lives.** Google retired Calendar Goals in 2022 ([Android Police](https://www.androidpolice.com/goals-leaving-google-calendar/)); users built replacements ([Reddit](https://www.reddit.com/r/google/comments/yiis9g/with_the_demise_of_goals_in_google_calendar_i/)).
2. **Partners who stay engaged.** "The problem with accountability partners: everyone's too nice" ([Reddit](https://www.reddit.com/r/getdisciplined/comments/1rkth0h/the_problem_with_accountability_partners/)); apps either hide misses or sell a $90/mo coach.
3. **Adjustable intensity.** Products sit at one end: money stakes and "BROKEN" records, or pure games.
4. **Per-member visibility.** Sharing is per habit at best (HabitShare), or Apple-only (Strides).
5. **Seasonal programs tied to real goals.** Cura's Winter Arc proves the demand but is a fixed rule set with no calendar, notes or benchmarks.

No consumer goal-accountability add-on for Google Calendar turned up on the [Workspace Marketplace](https://workspace.google.com/marketplace); the nearest are [Goals Tracker](https://workspace.google.com/marketplace/app/goals_tracker/460649096943) (Sheets only) and [Multiplii](https://workspace.google.com/marketplace/app/multiplii/168777195431) (B2B leadership).

## Appendix B. Sources
All pages opened on Oct 28, 2026.

- Google Calendar API scopes: [auth](https://developers.google.com/workspace/calendar/api/auth)
- Google sensitive-scope verification (up to 10 days): [production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- Unverified-app 100-user cap: [Google Cloud Help](https://support.google.com/cloud/answer/7454865)
- Push notifications: [Calendar push guide](https://developers.google.com/workspace/calendar/api/guides/push)
- Calendar add-ons (not on mobile): [overview](https://developers.google.com/workspace/add-ons/calendar), [actions](https://developers.google.com/workspace/add-ons/calendar/calendar-actions), [manifest](https://developers.google.com/workspace/add-ons/concepts/workspace-manifests), [publishing](https://developers.google.com/workspace/marketplace/how-to-publish)
- Subscribe to a calendar by URL: [Google Calendar Help](https://support.google.com/calendar/answer/37100); refresh delay per [Cheqroom](https://knowledge.cheqroom.com/helpcenter/how-often-does-google-update-its-calendar-feeds) and [Timetastic](https://help.timetastic.co.uk/hc/en-us/articles/203174832)
- Product pages and reviews: linked in the Market scan table
- Reddit: [strict partner request](https://www.reddit.com/r/getdisciplined/comments/1pp3rnj/looking_for_a_strict_accountability_partner_only/), [partners too nice](https://www.reddit.com/r/getdisciplined/comments/1rkth0h/the_problem_with_accountability_partners/), [Goals replacement](https://www.reddit.com/r/google/comments/yiis9g/with_the_demise_of_goals_in_google_calendar_i/)
