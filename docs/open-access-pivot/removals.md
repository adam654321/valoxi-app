# Open Access Pivot — Removals

Status: IN PROGRESS
Owner: Adam
Related: docs/open-access-pivot/plan.md, docs/open-access-pivot/assessment.md

Operational checklist. Items get ticked off as phases ship. Line references from the pre-build grep report (action log v62.1).

---

## Phase A1: Code removal

### Files to delete entirely

- [ ] `server/services/magic-link.service.ts`
- [ ] `server/services/password-reset.service.ts`
- [ ] `server/repositories/password-reset.repository.ts`
- [ ] `client/src/pages/auth/login.tsx`
- [ ] `client/src/pages/auth/forgot-password.tsx`
- [ ] `client/src/pages/auth/reset-password.tsx`
- [ ] `client/src/pages/auth/magic-link.tsx`
- [ ] `client/src/pages/auth/link-expired.tsx`

### Files to edit — methods to remove

- [ ] `server/services/auth.service.ts` — delete `register()` and `login()`. Remove `bcrypt` import and `SALT_ROUNDS` constant.
- [ ] `server/services/email.service.ts` — delete `sendMagicLinkEmail`, `sendLegacyFreePeriodWarningEmail`, `sendLegacyFreePeriodTransitionEmail`
- [ ] `server/repositories/users.repository.ts` — delete `createSession`, `getSessionByToken`, `deleteSession`, `deleteExpiredSessions`. Remove `userSessions` import.
- [ ] `server/repositories/team.repository.ts` — remove `passwordHash` from SELECT (line 177) and from filter (line 212). Remove `(clerkUserId OR passwordHash)` filter, keep just `clerkUserId IS NOT NULL`.
- [ ] `server/cron/billing.cron.ts` — delete monthly `community_free_months_remaining` decrement cron (lines 263-273). Delete legacy non-5D branch in 09:15 free-period cron (lines ~440-475 and ~525-540).

### Routes to delete

- [ ] `server/routes/auth.routes.ts`:
  - DELETE `POST /login` (line 26 — `authService.login` consumer)
  - DELETE `POST /forgot-password` (line 91)
  - DELETE `POST /reset-password` (line 102)
  - DELETE `POST /reset-password/validate` (line 112)
  - DELETE `POST /magic` (line 122)
  - DELETE `POST /resend-magic-link` (line 171)
- [ ] `server/routes/admin.routes.ts`:
  - DELETE `POST /admin/verify-credentials` (line 796 — bcrypt path)
  - DELETE `POST /admin/resend-magic-link` (line 619)
- [ ] `client/src/App.tsx`:
  - DELETE routes `/login`, `/forgot-password`, `/reset-password`, `/auth/magic`, `/auth/link-expired`
  - Remove imports for Login, ForgotPassword, ResetPassword, MagicLinkPage, LinkExpiredPage

### Middleware env gates to remove

- [ ] `server/middleware/auth.ts` — strip legacy session-fallback path in `isAuthenticated` (after Clerk auth attempt). Unauth = 401.
- [ ] `server/middleware/clerk-auth.ts` — remove `CLERK_ENABLED` env gate in `tryClerkAuth`
- [ ] `server/routes/webhooks.routes.ts` — remove `CLERK_ENABLED` check inside `revokeOrphanClerk`

### Dependencies to remove

- [ ] `package.json` — remove `bcrypt` and `@types/bcrypt`
- [ ] Confirm `bcrypt` not in `package-lock.json` after npm install

### Account routes — bcrypt-dependent code

- [ ] `server/routes/account.routes.ts` lines 81-95 — password change endpoint uses bcrypt. Either remove the endpoint (users change passwords via Clerk now) or rewrite to redirect users to Clerk's password management. Recommend: DELETE the endpoint, return 410 Gone with link to Clerk.

### Seed scripts — bcrypt usage

- [ ] `server/scripts/seed-admins.ts` lines 47, 88 — bcrypt usage in admin seed. Rewrite to NOT set passwordHash (Clerk handles), or delete the script entirely if no longer used.
- [ ] `server/scripts/seed-test-team-users.ts` lines 42, 55, 79 — same. Rewrite or delete.

---

## Phase B: Promo model

### Tables to drop

- [ ] `DROP TABLE promo_codes` (0 rows in prod, confirmed safe)

### Schema columns to add

- [ ] `promo_code_campaigns.slug VARCHAR(50) UNIQUE NOT NULL` (with backfill before NOT NULL)
- [ ] `promo_code_campaigns.max_total_claims INTEGER NULL`
- [ ] `promo_code_campaigns.is_active BOOLEAN NOT NULL DEFAULT TRUE`

### Service methods to remove

- [ ] `server/services/promo-code.service.ts` — delete `generateCodes()` method
- [ ] Add new methods: `resolveCampaignBySlug(slug)`, `assignCampaignToUser(userId, campaignId, attributedBy)`

### Admin routes to delete

- [ ] `server/routes/admin.routes.ts`:
  - DELETE `GET /admin/promo-codes` (listing endpoint)
  - DELETE `GET /admin/promo-codes/export` (CSV export)
  - UPDATE `POST /admin/promo-campaigns` to add `slug` field, remove `codeCount`/`codePrefix`/`maxUsesPerCode` body fields
  - UPDATE `GET /admin/promo-campaigns` to drop `generatedCount`/`claimedCount`/`remainingCount`, add `totalClaimedByUsers`

### Client pages to delete

- [ ] `client/src/pages/admin/promo-codes.tsx` (entire file)
- [ ] `client/src/App.tsx` — remove `/admin/promo-codes` route and import
- [ ] Create `client/src/pages/admin/promo-campaigns.tsx` — new UI with slug field + copy-URL button

### Refactor

- [ ] `server/routes/admin-waitlist.routes.ts` — replace inline `assignedPromoCampaignId/assignedByAdminId/assignedAt` mutation with `promoCodeService.assignCampaignToUser()` call

---

## Phase A2: Schema drop

After A1 + B + C + D + F stable in prod for 2 weeks.

### Tables

- [ ] `DROP TABLE user_sessions` (0 rows confirmed)
- [ ] `DROP TABLE password_reset_tokens` (1 row, safe — pre-DROP confirms)
- [ ] `DROP TABLE magic_links` (1 row, safe — pre-DROP confirms)
- [ ] `DROP TABLE resend_rate_limits` (no current code uses this, confirm 0 rows)

### Columns

- [ ] `users.password_hash` — DROP
- [ ] `users.last_login` — DROP
- [ ] `subscriptions.referral_source` — DROP (2 rows non-null in prod, historical only — confirm with Adam those subs don't need preserving)
- [ ] `subscriptions.promo_code_id` — DROP (0 rows non-null)
- [ ] `subscriptions.is_community_member` — DROP (0 rows non-null)
- [ ] `subscriptions.community_free_months_remaining` — DROP (0 rows non-null)

### Enums

- [ ] `setConfigSchema` in `server/routes/admin.routes.ts` line 596 — remove `'registration_mode'` from enum
- [ ] Pre-DROP: `DELETE FROM system_config WHERE key = 'registration_mode'` (if row exists)
- [ ] `server/scripts/seed-system-config.ts` line 6 — remove the seed entry for `registration_mode`
- [ ] `client/src/pages/admin/settings.tsx` — remove registration_mode UI section (lines 24, 93)

### Schema definitions

- [ ] `shared/schema/core.ts` — remove `userSessions`, `passwordResetTokens`, `magicLinks`, `resendRateLimits` tables. Remove `passwordHash`, `lastLogin` columns from `users`.
- [ ] `shared/schema/billing.ts` — remove `referralSource`, `promoCodeId`, `isCommunityMember`, `communityFreeMonthsRemaining` columns from `subscriptions`
- [ ] `shared/schema/core.ts` line 108 — `waitlist.discountTier` column. Confirm with Adam: is this still used or dead? If dead, drop in this phase.

---

## Phase G: Hygiene

### Stale documentation

- [ ] `replit.md` — Auth section: "express-session, bcrypt" → "Clerk + session for CSRF/view-as". Remove SMTP_* env vars (Resend is used). Update Drizzle Migration Strategy: "Use direct ALTER per #188 drift, NOT db:push". Update Stripe env vars list (add OPEN_ACCESS_ENABLED, RESEND_SEGMENT_SIGNED_UP_NO_PLAN).

### Marketing site

- [ ] `valoxi-site/.env.local` — remove `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (confirmed unused by Adam)
- [ ] Verify `valoxi-site/.gitignore` excludes `.env.local`. If `.env.local` is in git history, rotate Supabase service role key as precaution.
- [ ] `valoxi-site/src/components/sections/PricingToggle.tsx` — tier CTAs from `/#register` to `https://app.valoxi.ai/welcome?plan=core&interval=month` (etc per tier and interval). Label "Get Started →".
- [ ] `valoxi-site/src/components/layout/Navigation.tsx` — primary CTA from `/#register` to `https://app.valoxi.ai/welcome`. Keep "Register Your Interest" as secondary option (or remove — Adam decides).
- [ ] `valoxi-site/functions/api/waitlist.ts` — confirmation email copy: remove "Live accounts start going out from 21st April". Replace with "Your account is ready when you are. Sign up at app.valoxi.ai/welcome whenever you're ready."
- [ ] `valoxi-site/src/components/sections/RegisterForm.tsx` — submitted-state copy "You're on the list. We'll be in touch soon." → add link to /welcome for users ready to sign up now.

### Hardcoded values

- [ ] `server/routes/billing.routes.ts` — replace `INVOICE_RATE_CENTS = 7395` literal with `config.billing.coreMonthlyDiscountedCents`
- [ ] `server/config.ts` — add `billing.coreMonthlyDiscountedCents: 7395` constant

### Email copy

- [ ] `server/services/email.service.ts sendWaitlistInvitation` — verify trial line copy reads sensibly when user has no promo campaign (currently has `trialLineOverride` mechanism — confirm fallback)

---

## Phase C: Stripe checkout config

- [ ] `server/routes/billing.routes.ts` line 892 — change `allow_promotion_codes: true` to `allow_promotion_codes: false` for all checkouts (when no resolvedCoupon). Promo only flows via the three controlled paths.