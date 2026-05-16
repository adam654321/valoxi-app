# Open Access Pivot — Plan

Status: IN PROGRESS
Started: 2026-05-15 (action log v62)
Owner: Adam
Related: docs/open-access-pivot/assessment.md, docs/open-access-pivot/removals.md, docs/open-access-pivot/lessons.md, action log v62–v69

---

## What this pivot does

Valoxi today: admin invites users from a waitlist. Users get a 24h trial (or 6-month 5D New Member free period) and access the app. After trial, they pay.

After this pivot: marketing site visitors self-serve sign up. Anyone with a promo URL slug gets the matching discount. No admin required for normal signups, but admin direct-add still available for edge cases. Waitlist preserved as a soft option for hesitant prospects.

## Phases

| Phase | Scope | Risk | Action log |
|---|---|---|---|
| Pre-build | Replit grep pass to lock dead-code baseline | None | v62 → v62.1 |
| A1 | Code residue removal (bcrypt, magic links, password reset, legacy free-period) | Low | v62.1 → v63 ✓ COMPLETE |
| B | Promo model refactor: drop promo_codes table, add slug to campaigns | Low-Med | v63 → v64 |
| C | Public signup flow: /welcome page, /public/signup endpoint, Clerk webhook branch | High | v64 → v65 |
| D | Admin direct add user (with optional promo) | Low | v65 → v66 |
| F | 5D invoice rewrite + CSV export | Low | v66 → v67 |
| flip OPEN_ACCESS_ENABLED=true | Soft launch in prod | — | v67 → v67.1 |
| A2 | Schema residue drop (dead columns, dead tables) | Medium | v67.1 → v68 |
| G | Hygiene: replit.md, email copy, marketing site minimal CTAs | Low | v68 → v69 |
| E | Marketing site full overhaul | — | Deferred to separate session |

## Pre-build investigation — 36 users without Clerk link (RESOLVED 2026-05-16)

Pre-build grep found 36 active users in prod with `clerk_user_id IS NULL AND is_active = true`. Original assumption: pre-Clerk early-access users who never linked.

Investigation result: WRONG assumption. The 36 are stale Clerk invites — admin clicked Invite, DB row was created with email pre-fill, invitation email sent — user never completed Clerk signup. Webhook `user.created` never fired, so `clerk_user_id` never got backfilled.

Confirmed via:
- Clerk dashboard shows 39 active Clerk accounts; none of the 36 unlinked DB rows match
- Only 4 users ever had `password_hash`: Adam, Viv, Dee, Jag — all migrated
- All 36 are `lastLogin: (never)`, `sub: (none)`, company "Pending Setup"
- 35 on Early Bird promo, 1 on 5D Standard

Decision: leave them as dormant rows. Webhook email match is case-insensitive (LOWER on both sides) with no isActive filter. If any return via /welcome with same email, they auto-link and get their assigned promo applied. Small generosity for the buyer. No code blocker.

See assessment.md "36-user investigation" for full detail.

## Phase A1: Code residue removal (COMPLETE 2026-05-16, commit 1ac43a8)

Removed pre-Clerk auth surface and legacy free-period community surface. Code only. Schema kept until A2.

Outcome:
- 25 files changed: -2027 / +392
- 10 files deleted (8 dead auth pages/services + 2 unused seed scripts)
- TSC clean (1 pre-existing portal.service.ts:81 error only, unrelated)
- Smoke tests passed: Clerk sign-in, /account Clerk card, /admin/database access

Scope creep handled cleanly:
- admin/database.tsx bcrypt re-auth gate removed (page already gated by AdminRoute → isSystemAdmin)
- /login redirect at App.tsx:192 removed (beta-era bookmark, no longer needed)
- account.tsx legacy password change UI removed (lines 84-87, 124-135, 226-248)

Build hiccup: direct `npm uninstall bcrypt @types/bcrypt` via code_execution broke node_modules (Nix Node PATH issue). Recovered via Replit Packager UI in ~30 minutes. No code damage. See lessons.md LN-001.

Specific changes: see docs/open-access-pivot/removals.md section A1.

## Phase B: Promo model refactor

Drops promo_codes table. Adds slug + maxTotalClaims + isActive to promo_code_campaigns. Centralises allocation in service method.

Schema (direct ALTER):
- `ALTER TABLE promo_code_campaigns ADD COLUMN slug VARCHAR(50) UNIQUE`
- `ALTER TABLE promo_code_campaigns ADD COLUMN max_total_claims INTEGER`
- `ALTER TABLE promo_code_campaigns ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE`
- Backfill slugs on 3 existing campaigns (Adam confirms exact slugs at apply: suggest `5d`, `early-bird`, `5d-community`)
- `ALTER TABLE promo_code_campaigns ALTER COLUMN slug SET NOT NULL` (after backfill)
- `DROP TABLE promo_codes`

Service:
- Delete `generateCodes()` method
- Add `resolveCampaignBySlug(slug)` method
- Add `assignCampaignToUser(userId, campaignId, attributedBy)` method (used by all three allocation paths)

V-check:
- TSC clean
- `grep -rn "promoCodes\b" server/ shared/ client/src/` returns zero
- `grep -rn "generateCodes" server/` returns zero
- Prod DB: `SELECT count(*) FROM promo_code_campaigns WHERE slug IS NULL` returns 0
- Smoke: admin-waitlist invite flow still creates user + assigns campaign + sends invite

## Phase C: Public signup flow

The big one. New env var `OPEN_ACCESS_ENABLED` (default false, set true only when ready to launch).

New backend:
- `POST /api/v2/public/signup` (rate-limited via waitlistLimiter)
  - Body: `{email, firstName, lastName, promoSlug?, intendedPlan?, intendedInterval?, marketingConsent?}`
  - Validates open-access enabled, email not taken, promo slug resolves (if supplied)
  - Creates userCompany + users + userCompanyMemberships in transaction
  - If promo: calls `promoCodeService.assignCampaignToUser`
  - Returns `{redirectUrl: '/sign-up?email_address=...'}`
- `GET /api/v2/public/promo/:slug` — lightweight slug resolver for welcome page benefit copy

Modified backend:
- `handleUserCreated` Clerk webhook: if `OPEN_ACCESS_ENABLED && user.assignedPromoCampaignId IS NULL`, SKIP trial subscription creation. User signs in, onboards, lands on billing, middleware 402s, pays.
- `requireActiveSubscription` middleware: continues to 402 with `?reason=subscription_required` redirect. No change required.
- `marketingContactsService`: new segment `SIGNED_UP_NO_PLAN` for users with no subscription. Add `RESEND_SEGMENT_SIGNED_UP_NO_PLAN` env var to broadcasts service segments list.
- `billing.routes.ts /checkout`: set `allow_promotion_codes: false` (currently true). Promo only via the three controlled paths.

New client:
- `client/src/pages/welcome.tsx` at route `/welcome?plan=...&interval=...&promo=...`
- Form: email, first name, last name, optional marketing consent checkbox (default unchecked, GDPR)
- If `?promo=` supplied, fetches `/api/v2/public/promo/:slug` to show benefit copy ("You'll get 6 months Core free + 15% off after")
- Submit → `POST /api/v2/public/signup` → redirect to Clerk

Modified client:
- `App.tsx`: add `/welcome` route to unauthenticated switch
- `billing.tsx`: when no sub AND `?plan=` query param, auto-scroll-highlight that plan

Phase C design item flagged during A1: `/welcome` flow needs to handle the case where submitted email already exists in DB (e.g. one of the 36 dormant rows, an active user, or a soft-deleted user). Sensible behaviour: redirect to /sign-in with "looks like you already have an account" message.

V-check:
- TSC clean
- Manual end-to-end:
  - `/welcome?plan=core&interval=month` (no promo) → form → Clerk signup → onboarding → /billing (402 banner) → Core checkout → Stripe → pay → sub active
  - `/welcome?plan=core&interval=month&promo=5d` → form → Clerk signup → onboarding → /dashboard (6-month free trial active)
  - `/welcome?promo=invalid-slug` → 400 with "promo not found" error on page
  - `OPEN_ACCESS_ENABLED=false` → /welcome page loads but submit returns 400 with "open access not enabled" message
  - Email collision: existing email at /welcome submit → redirect to /sign-in with friendly message

## Phase D: Admin direct add user

`POST /api/v2/admin/users/direct-add`:
- Body: `{email, firstName, lastName, promoCodeCampaignId?, sendInvitationEmail?}`
- Same transaction pattern as admin-waitlist invite step 5–9
- Optionally sends `sendWaitlistInvitation` email (template reuse)

New client: "Add user manually" button on `/admin/users` page. Modal with form + promo campaign dropdown.

V-check:
- TSC clean
- Manual: admin adds user with 5D campaign selected → user row created → invitation email sent → user clicks link → Clerk signup → 5D trial sub created

## Phase F: 5D invoice rewrite

Replaces broken `/admin/referral-invoice` with new query against current data model.

Current state: 2 rows in prod subscriptions have `referralSource` set (historical writes only — current code doesn't write the column). Current invoice shows only those 2 — incomplete picture.

New query: SELECT users with `assignedPromoCampaignId` joining `promo_code_campaigns` WHERE `referralSource='5d_community' AND freeMonthsTotal=6`, joining subscriptions on userCompany. Compute elapsed/remaining months from `freeMonthsStartedAt`.

Files:
- `server/config.ts`: add `billing.coreMonthlyDiscountedCents: 7395` constant
- `server/routes/billing.routes.ts`: replace `INVOICE_RATE_CENTS = 7395` literal with config constant
- `server/routes/admin.routes.ts`: rewrite `GET /admin/referral-invoice`, add `GET /admin/referral-invoice/csv`
- `client/src/pages/admin/referral-invoice.tsx`: update display, add Download CSV button

Rate: $73.95/member/month ($87 CORE × 0.85, the 15% discounted price).

V-check:
- Hit `GET /admin/referral-invoice` for current month → returns actual 5D New Member users with correct math
- CSV downloads, opens cleanly in Excel

## Phase A2: Schema residue drop

After A1, B, C, D, F prove stable in prod for 2 weeks.

Schema (direct ALTER):
- DROP TABLE user_sessions
- DROP TABLE password_reset_tokens
- DROP TABLE magic_links
- DROP TABLE resend_rate_limits
- ALTER TABLE users DROP COLUMN password_hash
- ALTER TABLE users DROP COLUMN last_login
- ALTER TABLE subscriptions DROP COLUMN referral_source
- ALTER TABLE subscriptions DROP COLUMN promo_code_id
- ALTER TABLE subscriptions DROP COLUMN is_community_member
- ALTER TABLE subscriptions DROP COLUMN community_free_months_remaining
- Remove `registration_mode` from `setConfigSchema` enum

Pre-DROP queries confirm 0 rows for each before drop.

V-check:
- TSC clean
- `npm run build` clean
- App boots, all flows work

## Phase G: Hygiene

- `replit.md`: Auth section to "Clerk + session for CSRF/view-as". Update env vars list (add OPEN_ACCESS_ENABLED, RESEND_SEGMENT_SIGNED_UP_NO_PLAN; remove dead SMTP_*). Update Drizzle Migration Strategy note (direct ALTER, not db:push, per #188 drift). Document promo slug model.
- Marketing site `.env.local`: remove `SUPABASE_*` keys (confirmed unused per Adam)
- Marketing site `functions/api/waitlist.ts`: update confirmation email copy (drop dated rollout language)
- Marketing site `PricingToggle.tsx`: tier CTAs to `app.valoxi.ai/welcome?plan=...&interval=...`
- Marketing site `Navigation.tsx`: primary CTA to `app.valoxi.ai/welcome`
- Email service `sendWaitlistInvitation`: verify trial line copy reads sensibly when no promo

## Risk register

| # | Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|---|
| 1 | ~~bcrypt strip locks out the 36 active users without Clerk link~~ FALSE ALARM | n/a (resolved) | n/a | Investigation 2026-05-16 confirmed all 36 are stale Clerk invites (admin invited via current flow, never completed Clerk signup). No bcrypt passwords. A1 affected none of them. See assessment.md. RESOLVED. |
| 2 | Email mismatch: user fills /welcome with email A, signs into Clerk with Google email B | Medium | Medium | Welcome page warning copy. `?email_address=` Clerk pre-fill. Orphan-revoke kicks in if mismatch. |
| 3 | Schema drop in A2 wipes needed data | Low | High | Pre-DROP queries confirm 0 rows. Backups in repo. A2 ships last. |
| 4 | OPEN_ACCESS_ENABLED flipped on accidentally before C is ready | Low | Medium | Env var defaults false. Explicit set required. |
| 5 | Marketing site CTA points to /welcome before app has the route | Medium | Low | Sequence: ship app side first, flip marketing CTAs as part of C apply |
| 6 | Stripe `allow_promotion_codes: false` breaks existing user who relied on typing a code | Very low | Low | Promo today only attaches via assignedPromoCampaignId. Stripe field was parallel mechanism Adam wasn't using. |
| 7 | New `getTeamMembers` filter loses users we want to keep | Low | Medium | Same as risk 1 — resolved by investigation, no real exposure |
| 8 | Welcome page race condition: signup succeeds, Clerk signup abandoned, orphan DB row | Medium | Very low | Don't care. Dormant row, no harm. If same email retries, Clerk webhook links it. |
| 9 | Email collision at /welcome submit (email already in DB) | Medium | Low | Phase C design item. Sensible behaviour: redirect to /sign-in with "looks like you already have an account" message. Webhook handles linking on Clerk signup if user proceeds. |
| 10 | Direct npm dependency changes break Replit node_modules | Confirmed (A1) | Medium | Use Replit Packager UI for npm install/uninstall, never direct npm via code_execution. See lessons.md LN-001. |

## Open decisions

| # | Question | Resolved? |
|---|---|---|
| 1 | `/welcome?promo=invalid-slug` — silent ignore or hard error? | Hard error (400). Confirmed. |
| 2 | New Resend segment name | `SIGNED_UP_NO_PLAN`. Confirmed. |
| 3 | Welcome page marketing_consent default | Unchecked (GDPR). Confirmed. |
| 4 | Marketing site keep /request-access standalone for demos | Yes. Confirmed. |
| 5 | Exact slugs for 3 existing campaigns | Adam confirms at Phase B apply. Suggested: `5d`, `early-bird`, `5d-community`. |
| 6 | 5D rate | $73.95/member/month. Confirmed. |
| 7 | ENTERPRISE pricing display on marketing site | "Contact for pricing", not "unlimited". Confirmed. |
| 8 | After 6-month free period, no payment → cancel (current behaviour) | Keep. Confirmed. |
| 9 | Action log compression v57-v59 | Separate workstream. Adam handles via Claude Code skill. |
| 10 | The 36 prod users without Clerk link — what to do | RESOLVED. Leave as dormant rows. Stale Clerk invites with no bcrypt hashes. If any return via /welcome with same email, webhook auto-links + applies their promo. |
| 11 | admin/database.tsx bcrypt re-auth gate — keep, swap, or remove? | RESOLVED. Removed. Page already gated by AdminRoute → isSystemAdmin. Bcrypt gate was theatre. |
| 12 | Seed scripts seed-admins/seed-test-team-users — keep, rewrite, or delete? | RESOLVED. Deleted both. Admin direct-add (Phase D) handles new admin onboarding manually. |
| 13 | /login redirect at App.tsx:192 — keep as soft landing for old bookmarks? | RESOLVED. Removed. Beta cohort small, all migrated. 404 acceptable for stale bookmarks. |

## Action log progression

| Version | Phase | Notes |
|---|---|---|
| v62 | Open access kickoff | Pivot scoped, 4-wave codebase assess completed |
| v62.1 | Pre-build complete | Replit grep pass + docs written + plan locked + 36-user investigation |
| v63 | A1 complete ✓ | Code residue removed (2026-05-16, commit 1ac43a8) |
| v64 | B in progress | Promo model refactor — slugs + drop promo_codes |
| v65 | C in progress | Public signup live (flag still off) |
| v66 | D in progress | Admin direct add live |
| v67 | F in progress | 5D invoice rewrite live |
| v67.1 | OPEN_ACCESS_ENABLED=true | Soft launch in prod |
| v68 | A2 in progress | Schema residue dropped |
| v69 | G in progress | Hygiene + marketing minimal CTAs live |
| Future | E | Marketing site full overhaul (separate workstream) |