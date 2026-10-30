# GoalKin — Architecture (read before writing code)

Next.js 16.4 App Router (TypeScript, Tailwind v4, Turbopack) on Vercel + self-hosted Supabase (Postgres, Auth, Storage). **Next 16 differs from older versions**: `middleware.ts` is now `src/proxy.ts`; `params`, `searchParams`, `cookies()`, `headers()` are async (await them). Docs for the installed version: `node_modules/next/dist/docs/`. Cache Components is **off**; pages are dynamic.

## Layout
| Path | What |
|---|---|
| `supabase/migrations/0001_goalkin_core.sql` | Schema + RLS. All tables `gk_*`. |
| `src/lib/types.ts` | Domain types (match the SQL). |
| `src/lib/supabase/{server,client,admin}.ts` | RLS client for the signed-in person (server), browser client, service-role client (server-only). |
| `src/lib/auth.ts` | `requireUser()` → `{ supabase, user, profile }`; `requireAdmin()`. |
| `src/lib/visibility.ts` | **Privacy gate.** `canSee`, `audienceFor`, `buildSharedView`. |
| `src/lib/goals.ts` | `loadOwnGoal`, `loadSharedGoal`, `loadPublicGoal`, `previewFor`, `sharedWithMe`. |
| `src/lib/plan.ts`, `src/lib/ai.ts` | Deterministic plan builder; AI draft (`draftPlan`, `sharpenGoal`). |
| `src/lib/approach.ts`, `src/lib/tone.ts`, `src/lib/progress.ts` | Approach/readiness questions, tone wording, streak/percent/restart. |
| `src/lib/entitlements.ts` | Plans, limits, `effectivePlan`. |
| `src/lib/experiments.ts` | `variantFor(expId, userId)`, `track(userId, event, props)`. |
| `src/lib/templates.ts` | `listTemplates`, `getTemplate`, `readFullTemplate`, `readCatalog`. |
| `src/components/ui.tsx` | Button, ButtonLink, Card, PageHeader, Field, Input, Textarea, Select, StatusPill, Notice, ProgressBar, Empty. |

## Rules
1. **Private by default.** Never return another person's raw rows. Shared data goes through `loadSharedGoal` / `buildSharedView`. Any share UI shows the preview from `previewFor`.
2. **AI drafts, person decides.** Every plan item editable/removable (except `required` guardrails, which can only be completed), people can add their own.
3. **No medical/financial/guaranteed-result claims.** Health/Wealth goals carry the guardrail steps from `requiredGuardrails`. Label suggestions and affiliate links.
4. **Phone first, accessible:** 44px touch targets (`min-h-11`), labels on every input, `StatusPill` (icon + word, never colour alone), works at 200% zoom, light/dark via CSS variables (`bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-navy`, `text-sage-ink`, `text-coral-ink`, `text-gold-ink`).
5. Mutations: Server Actions (`"use server"`) using `requireUser()`'s RLS client; service-role only for cross-person work (invites, circles join, webhooks, cron), and validate input with zod.
6. Fonts: `font-display` (Playfair) for headings, `font-fun` (Nunito) for playful word art, default Inter.

## Routes
| Route | Owner area |
|---|---|
| `/` landing, `/pricing`, `/legal/{terms,privacy,notices}` | public |
| `/login`, `/auth/callback`, `/auth/signout` | auth |
| `/onboarding` | 9-step playful onboarding → creates goal |
| `/app` (Today), `/app/goals`, `/app/goals/new`, `/app/goals/[id]`, `/app/goals/[id]/share`, `/app/goals/[id]/edit` | goals |
| `/app/circles`, `/app/circles/[id]`, `/join/[code]`, `/invite/[token]` | circles & partners |
| `/app/focus`, `/app/focus/[id]` | focus rooms |
| `/app/settings` | profile, approach, calendar, push, reminders |
| `/marketplace`, `/marketplace/[id]`, `/app/library`, `/app/custom` | templates |
| `/creators`, `/creators/dashboard`, `/creators/templates/new` | creators |
| `/admin` | reviews, experiments, week-4 metric |
| `/s/[token]` public share page, `/api/og/[token]` share image | sharing |
| `/api/ics/[token]`, `/api/google/*`, `/api/push/*`, `/api/cron/*`, `/api/webhooks/ghl`, `/api/checkin` | integrations |

## Environment variables
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GK_AI_MODEL` (optional), `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `RESEND_API_KEY`, `GK_EMAIL_FROM`, `CRON_SECRET`, `GHL_WEBHOOK_SECRET`, `GK_ADMIN_EMAILS`, `GK_CHECKOUT_*` (PRO_MONTHLY, PRO_YEARLY, CIRCLE, CLUB, FINISH_THE_YEAR, NEW_YEAR_RESET), `CHECKIN_LINK_SECRET`.
