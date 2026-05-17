# Open Access Pivot — Assessment

Status: HISTORICAL (assessment complete 2026-05-15, amended 2026-05-16 with 36-user investigation)
Owner: Adam
Related: docs/open-access-pivot/plan.md, docs/open-access-pivot/removals.md, docs/open-access-pivot/lessons.md, action log v62+

---

## Why this pivot exists

Valoxi launched waitlist-gated: marketing site collects interest, admin reviews and invites, invited user signs up via Clerk and gets either a 24h trial or a 6-month 5D New Member free period.

The waitlist gate adds friction and blocks marketing efficiency: every signup needs admin review. The pivot removes the gate. Visitors can self-serve sign up from the marketing site. Promo URL slugs replace individual code generation.

Knock-on consequences from a four-wave codebase assessment:
- Pre-Clerk auth surface (bcrypt + magic links + password reset) is dead but still wired. Blocks clean signup flow design.
- Legacy free-period community model from an earlier 5D variant has dead code + dead schema columns still in place
- `/admin/referral-invoice` endpoint is broken on current data model (filters on a column nobody writes)
- 36 active users in prod still appeared at first to be on the pre-Clerk path. Investigation 2026-05-16 disproved this — see "36-user investigation" section below.

Cleaning these up is half the work. The signup flow itself is small once the dead surface is gone.

## Wave 1 findings — pre-Clerk auth residue

Migration trail in `migrations/`:
- 0000–0003: pre-Clerk era (bcrypt + session)
- 0004–0005: Clerk transition
- 0006: waitlist
- 0007: idempotency

Dead surfaces still in code (REMOVED IN A1):
- `server/services/magic-link.service.ts`, `server/services/password-reset.service.ts`, `server/repositories/password-reset.repository.ts`
- `authService.register()`, `authService.login()` (bcrypt-based)
- Routes: `/login`, `/forgot-password`, `/reset-password`, `/auth/magic`, `/auth/link-expired`, `/admin/verify-credentials`, `/admin/resend-magic-link`
- Pages: `client/src/pages/auth/login.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `magic-link.tsx`, `link-expired.tsx`
- Email templates: `sendMagicLinkEmail`, `sendLegacyFreePeriodWarningEmail`, `sendLegacyFreePeriodTransitionEmail`
- `CLERK_ENABLED` env gate in middleware (Clerk now unconditional)

Dead surfaces still in DB schema (KEPT for A2, code consumers removed in A1):
- Schema columns: `users.password_hash`, `users.last_login`
- Schema tables: `user_sessions`, `password_reset_tokens`, `magic_links`, `resend_rate_limits`

Dead surfaces in the legacy free-period community model (CODE REMOVED IN A1, SCHEMA KEPT for A2):
- `subscriptions.referralSource`, `subscriptions.promoCodeId`, `subscriptions.isCommunityMember`, `subscriptions.communityFreeMonthsRemaining` (read-only or unused)
- `promo_codes` table (entire table — 0 rows in prod) — drops in Phase B
- Monthly `community_free_months_remaining` decrement cron job (REMOVED IN A1)
- Legacy non-5D branch in 09:15 free-period cron (REMOVED IN A1)

## Wave 2 findings — current happy path

Today's user journey (admin-invited):
1. Marketing site `/request-access` form → `/api/v2/public/waitlist`
2. Admin reviews in `/admin/waitlist`
3. Admin clicks Invite with promo campaign selected
4. Single transaction creates `userCompany`, `users` (with `assignedPromoCampaignId`), `userCompanyMemberships`
5. `sendWaitlistInvitation` email sent (Resend)
6. User clicks email link → `/sign-up?email_address=...` (Clerk hosted UI)
7. User completes Clerk signup
8. Clerk fires `user.created` webhook → `handleUserCreated` matches by email (case-insensitive, no isActive filter), links `clerkUserId`
9. Webhook calls `createFiveDNewMemberTrial(userCompanyId)` if 5D campaign, else `createTrialSubscription(1)` for 24h trial
10. Webhook seeds pipeline stages, sends welcome email, syncs to Resend marketing audiences
11. User lands at `/`, routed to `/onboarding`
12. Onboarding form: company name, industry, size, country, role, T&C, DPA
13. After onboarding, `/dashboard` (trial users get full access)
14. Eventually `/billing` page → Stripe checkout → webhook activates subscription

Key insight: the infrastructure for the open-access flow is mostly already there. The new builds are:
- A `/welcome` page (intermediate before Clerk hosted UI) to capture form data + promo slug
- A `/public/signup` endpoint (creates DB row before Clerk webhook fires, prevents orphan-revoke)
- A branch in `handleUserCreated` to skip trial creation when open-access and no promo

## Wave 3 findings — third-party integrations

### Clerk
- Mounted at `/api/v2/*` via `clerkMiddleware()`
- Webhook: `POST /api/v2/webhooks/clerk` (svix-verified)
- Events: `user.created`, `user.updated`, `user.deleted`
- Webhook email match: case-insensitive (LOWER on both sides of comparison), NO isActive filter — selects across active and inactive rows, then checks isActive as application-level guard
- Orphan-revoke: when Clerk webhook fires with no DB match, `clerkClient.users.deleteUser()` destroys the Clerk account. THIS IS THE ACCESS GATE — keep secure. Also triggers when matched row has `isActive=false` (reason: `matched_user_inactive`).
- Admin reset-password: `clerkClient.signInTokens.createSignInToken({userId, expiresInSeconds: 86400})`

### Stripe
- Mounted at `/api/v2/billing`
- Webhook: `POST /api/v2/billing/webhook/stripe` (signature-verified, idempotent via `subscription_events.stripeEventId`)
- Events handled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.upcoming`
- Lookup keys: `ma_core_monthly_usd`, `ma_core_annual_usd`, `ma_professional_monthly_usd`, `ma_professional_annual_usd`, `ma_expert_monthly_usd`, `ma_expert_annual_usd`, `ma_addon_company_slot`, `ma_addon_seat`
- Currency: USD throughout. Stripe shows GBP equivalent at checkout via Stripe's local-currency feature.
- Coupon paths: `promoCodeService.resolveCheckoutCoupon(userId)` reads `users.assignedPromoCampaignId` → returns Stripe coupon ID. Currently `allow_promotion_codes: true` allows users to type any active Stripe coupon — flipping to false in Phase C so promo only flows through controlled paths.

### Resend
- Two API keys: `RESEND_API_KEY` (transactional via `email.service.ts`) and `RESEND_API_KEY_MARKETING` (audiences + broadcasts via `resend-marketing.ts`)
- 6 marketing segments via env vars: `RESEND_SEGMENT_ALL_USERS`, `_ACTIVE_SUBSCRIBERS`, `_CANCELLED_SUBSCRIBERS`, `_PAST_DUE`, `_TRIALING`, `_TEST_INTERNAL`
- New segment in Phase C: `SIGNED_UP_NO_PLAN` for open-access users pre-subscription
- Webhook: `POST /api/v2/webhooks/resend-marketing` handles `email.suppressed` only
- Broadcasts: admin sends to a segment; requires test-send in same session within 60min before real-send

### Cloudflare Pages (marketing site)
- Next.js 16 + Tailwind + shadcn at separate repo `valoxi-site/`
- Deployed to Cloudflare Pages
- Serverless functions at `functions/api/`
- `/api/waitlist` Cloudflare function proxies to app's `/api/v2/public/waitlist`, sends Resend confirmation email
- `.env.local` contains `SUPABASE_SERVICE_ROLE_KEY` — confirmed unused (legacy from earlier iteration). Will be removed in Phase G hygiene.

## Wave 4 findings — client + marketing site state

### App client
- Routes `/sign-up` and `/sign-in` conditional on `clerkEnabled` from `/api/v2/public/config`. Since `CLERK_ENABLED=true` in prod, they always render.
- Legacy routes removed in A1: `/login`, `/forgot-password`, `/reset-password`, `/auth/magic`, `/auth/link-expired`
- Sign-up page accepts `?email_address=` query param for Clerk pre-fill
- Onboarding gate: `user.onboardingCompleted === false` forces redirect to `/onboarding`
- Billing page already shows `?reason=subscription_required` banner when middleware 402s — infrastructure for "no sub → land on billing → pay" already there
- Pricing hardcoded in both `client/src/pages/billing.tsx` and `valoxi-site/src/components/sections/PricingToggle.tsx` — must stay in sync

### Marketing site
- Single home page + `/request-access` standalone page (kept for demos)
- No `/pricing` page route exists (PricingToggle links to `/pricing` which is broken)
- All tier CTAs currently → `/#register` (waitlist form), not signup
- "Member Login" → `https://app.valoxi.ai/sign-in`
- Confirmation email contains dated copy: "Live accounts start going out from 21st April"

## Key decisions and why

### Promo: slug per campaign, no individual codes
Decision: drop `promo_codes` table entirely. Each campaign gets a URL-safe `slug`. Anyone with the URL gets the promo. No code generation needed.

Why: Adam's stated preference — "ideally I don't really want to have to be generating codes". Three distribution paths suffice:
1. Admin invite from waitlist (campaign assigned via admin UI)
2. Admin direct add (new endpoint, optional promo)
3. Public URL with `?promo=<slug>` (resolves at /welcome)

Tradeoff: slug is public-by-design. Anyone who finds it can claim. For 5D this is acceptable — Adam gives them the URL once, they publish to members. For private one-off deals, admin-invite path handles it without exposing slug.

### Default OPEN_ACCESS_ENABLED to false
Env var off by default. Explicit `OPEN_ACCESS_ENABLED=true` required in prod. Safe rollback — flip back to false and waitlist becomes the only path again.

### USD pricing on marketing site
Confirmed by Adam. Stripe shows GBP equivalent at checkout via Stripe's local-currency feature. No GBP price set needed. Avoids doubling the Stripe price config.

### ENTERPRISE: "Contact for pricing"
Not unlimited per the marketing copy I initially drafted. Adam clarified: invoiced based on required levels. True unlimited would be ~$5k/month. Marketing site shows "Contact for pricing", invoice-only.

### 5D rate: $73.95/member/month
$87 CORE × 0.85 = $73.95 (the 15% discounted price). 5D community pays Valoxi $73.95 per member per month during the 6-month free period. After 6 months, member pays directly at $73.95/month.

Current code has two literals: `INVOICE_RATE_CENTS=7395` (correct, in billing.routes.ts) and `INVOICE_RATE=50.25` (stale, in /admin/referral-invoice). Phase F consolidates to one config constant.

### Welcome page → Clerk hosted UI (not Clerk before form)
Decision: collect form data on our domain first, create DB row, then redirect to Clerk hosted UI with email pre-fill.

Why: preserves orphan-revoke as the access gate. If we sent users to Clerk first, the webhook would fire and find no DB row → revoke would kill the account. The intermediate `/welcome` page is required to avoid that.

Tradeoff: extra page on the signup flow. Acceptable — also gives space for promo benefit copy.

## 36-user investigation (2026-05-16)

Pre-build flagged 36 active users in prod with `clerk_user_id IS NULL`. Original assumption: pre-Clerk early-access users who never linked, would be locked out by A1's bcrypt strip.

Investigation result: ASSUMPTION WAS WRONG.

What they actually are: stale Clerk invites. Admin clicked Invite from waitlist, DB row created with email pre-fill, invitation email sent — user never completed Clerk signup. Webhook `user.created` never fired for them, so `clerk_user_id` never got backfilled.

Confirmed via:
- Clerk dashboard shows 39 active Clerk accounts; all 36 unlinked DB rows are NOT in Clerk
- Only 4 users in prod ever had `password_hash`: Adam (Coxon), Viv (Kuvelker), Dee (Ludlow), Jag (Saran) — all migrated to Clerk
- All 36 are `lastLogin: (never)`, `sub: (none)`, company name "Pending Setup"
- 35 on Early Bird promo, 1 on 5D Standard

Webhook match logic also confirmed during the same investigation:
- Email comparison: case-insensitive via raw SQL `LOWER(${users.email}) = LOWER(${email.trim()})`
- No `isActive` filter in the WHERE clause — selects across active and inactive rows
- After match, application-level guard: if `isActive=false`, calls `revokeOrphanClerk('matched_user_inactive')` and deletes Clerk account
- If `clerkUserId` already populated and matches incoming, idempotent no-op
- If `clerkUserId` already populated but DIFFERENT to incoming, revokes the newer Clerk account (conflict path)

Decision: leave the 36 as dormant rows. No soft-delete needed. Net effect: any of them who later sign up via open-access flow get their Early Bird (or 5D) promo applied automatically. Small generosity for the buyer.

Implication for Phase C `/welcome` flow: the public/signup endpoint must handle the case where the submitted email already exists in DB (whether one of these 36, an active user, or a soft-deleted user). Sensible behaviour: redirect to /sign-in with "looks like you already have an account" message. To be designed in Phase C.

## Prod state at assessment time (2026-05-15)

From pre-build grep verification:
- 36 active users without `clerk_user_id` — RESOLVED 2026-05-16, see 36-user investigation
- 0 user_sessions rows — safe to drop table
- 1 password_reset_tokens row, 1 magic_links row — trivial, safe to drop
- 0 community member subscriptions — safe to remove legacy free-period column/code
- 2 subscriptions with `referralSource` non-null — historical writes, /admin/referral-invoice currently shows only these 2 (incomplete picture)
- 0 promo_codes rows — safe to drop entire table
- CORE monthly Stripe price confirmed at 8700 cents ($87.00)
- CLERK_ENABLED=true confirmed in env (removed unconditionally in A1)

Seed table state in prod (confirmed during A1):
- activity_types: 6 rows
- pipeline_stages: 10 rows
- dd_requirements: 121 rows
- deal_document_templates: 4 rows
- user_roles: 7 rows
- system_config: 1 row

All six seed tables already populated. The `/admin/database` seed-runner page is effectively a no-op in prod (all seed functions are idempotent).

Auto-seeded on user signup vs manual-only:
- ✅ seedDefaultPipelineStages — auto-seeded on first Clerk link (only if no subscription exists). Internally calls seedSystemConfig.
- ✅ seedUserRoles — auto-seeded at server startup, every restart
- ❌ seedActivityTypes, seedDDRequirements, seedDealDocumentTemplates — manual-only

## Deferred to other workstreams

| Item | Reason |
|---|---|
| Marketing site full overhaul (new /pricing page, hero rewrite, design pass) | Adam: separate session. Minimal CTA changes only here. |
| Single-source-of-truth pricing (pull from Stripe at runtime) | Not blocking. Defer. |
| GBP price set in Stripe | Confirmed USD-only is fine. |
| Removing `communityDiscountCouponId` overload (real coupon vs sentinel) | Keep semantics. Refactor later if it bites. |
| Action log compression v57-v59 | Adam handles via Claude Code skill, separate workstream. |
| Admin "delete user" Clerk-aware path | Not needed for open access. Later if churn requires hard deletes. |
| Sign-up funnel analytics refinement | funnelEvents already exists. Open-access events will show up post-launch. |
| Offer letter send error (not checking both areas) | Backlog. Investigate post-pivot. Flagged 2026-05-16 during A1 V-check. |
| portal.service.ts:81 TSC error | Pre-existing, unrelated. Backlog. |

## Stripe-first rework (2026-05-16)

Phase C was re-planned mid-build after dev testing of the account-first
/welcome flow. Reason: account-first added a redundant data-entry step
(/welcome collects email+name; Stripe Checkout collects the same) and
produced a confusing "trial has ended" billing state for open-access users
who never had a trial.

Decision: switch to Stripe-first / post-payment provisioning — the standard
SaaS pattern for paid-first products. Stripe Checkout is the email+payment
capture point; the signed checkout.session.completed webhook provisions the
account.

Stripe surface findings (assess 2026-05-16):
- Stripe webhook EXISTS: billingWebhookRoutes in billing.routes.ts, mounted
  at index.ts:109 without auth (correct). Signature-verified via
  stripe.webhooks.constructEvent. Idempotent via getEventByStripeId.
- Handles checkout.session.completed, customer.subscription.updated/deleted,
  invoice.paid/payment_failed/upcoming.
- checkout.session.completed currently provisions a SUBSCRIPTION only, keyed
  on metadata.userCompanyId — assumes the user already exists.
- /verify-session ALSO provisions (browser-triggered, post-redirect). This is
  double-provisioning; only idempotency saves it. The rework demotes
  /verify-session to read-only.
- resolveCheckoutCoupon takes a userId — unusable pre-account. The rework
  uses resolveCampaignBySlug (returns full campaign incl. stripeCouponId).
- activateSubscription uses upsertByCompanyId (insert-or-update on
  userCompanyId unique constraint).
- Multi-company gate: in-app, no-subscription users blocked from adding
  companies. Stripe-first satisfies this for free. Exact gate location
  NEEDS CONFIRMATION.

Consequence: C.1 (/public/signup) and C.3 (/welcome page) are superseded.
C.2's trial-creation branch is removed. Phase B and resolveCampaignBySlug
stand and are load-bearing for the new checkout path.