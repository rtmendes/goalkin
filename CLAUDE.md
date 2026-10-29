# CLAUDE.md — GoalKin

GoalKin is a goal-accountability app: goals become calendar plans, people share progress with the people in their corner at the level they choose (Private, Chosen people, Circle, Public, with a switch per number), an AI builds a personalized plan from a playful onboarding, and a template marketplace sells free, premium, creator and advanced custom templates.

Read before planning work: `docs/PRD.md` (what and why), `docs/SOP.md` (how we build and launch), `docs/MARKETPLACE.md` (templates and creators), `templates/catalog.json` (44 launch templates), `templates/schema.json` (template format), `brand/` (logo, word art, landing page draft).

## Non-negotiables
- Default visibility is Private; nothing is shared without the owner choosing it, and every share shows a preview of exactly what others see.
- No medical, financial or guaranteed-result claims. Health, diet and supplement goals include a "talk to your doctor" step. Suggestions and affiliate links are labeled.
- The AI drafts; the person decides. Every plan item is editable, removable, and people can add their own.
- Phone first. Light and dark themes. Accessible (200% zoom, screen-reader labels, no colour-only meaning).
- Brand: Ink Navy #14213D, Champagne Gold #C9A86A, Ember Coral #FF6B4A, Steady Sage #2F7D6D, Ivory #F7F3EC; Playfair Display, Nunito, Inter.
- Tech defaults (org standard): Supabase (self-hosted at supabase.insightprofit.live) and Vercel; GoHighLevel checkout for paid programs until the marketplace has its own payments.

## Secrets & automation (evergreen Infisical — org standard)

- All secrets live in Infisical: project `75ce45d4-9209-45b0-a24d-a2078132f2f8`,
  env `prod`. Never ask the user to paste a secret that exists there.
- Sessions self-provision: the SessionStart hook exports secrets to `.env.local`
  (gitignored), `.mcp.json` provides Infisical MCP tools, `scripts/with-env.sh`
  injects secrets at runtime, and `scripts/secrets.mjs` is a zero-dep Node loader
  (`await loadSecrets()`).
- If a needed secret NAME is missing but an equivalent exists under another name,
  create an alias yourself: `scripts/infisical-ensure-secret.mjs NAME --ref EXISTING`
  (create-if-missing only; allowlisted). Updating/deleting secrets requires asking.
- Automation-first: never ask the user to do manually what can be done
  programmatically from this environment. Only hand over a step when genuinely
  impossible (auth-gated UI), and then as an exact copy-paste.

## Project-Management Mode (standing rule)

This repo tracks its work in `TASKS.md`. That file — not the chat history — is
the source of truth for the goal and the to-do list. Context can compress; the
file cannot. Treat it as the project's memory.

**At the START of every session, before doing anything else:**
1. Read `TASKS.md`.
2. Restate the **Goal** in one line.
3. Show the **To-do**: what is done `[x]`, in progress `[~]`, and pending `[ ]`.
4. State the **Next step** and any **Blocked on** item.
5. Ask the user to confirm the next step (or say "continuing with <X>") before
   starting substantive work.

If `TASKS.md` does not exist, create it from `project-mode/TASKS.template.md`
(or the same template in the design-research repo) by inferring the goal and
current state from the repo, then confirm it with the user.

**As work progresses:** keep `TASKS.md` current — check off finished items,
mark what's in progress, update the **Next step** and **Last updated** lines.

**Before ENDING a session:** update `TASKS.md` so the next session (yours or a
parallel one) can pick up cleanly. The last thing you write is the state, not a
summary that only lives in this thread.

**Credentials never block work here:** secrets load automatically from the vault
on session start (see the Secrets section). Never
stall a task waiting on a credential — if a needed secret name is missing, create
it with `scripts/infisical-ensure-secret.mjs` and continue.
