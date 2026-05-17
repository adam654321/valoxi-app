# Open Access Pivot — Removals

Status: A1 COMPLETE / B IN PROGRESS
Owner: Adam
Related: docs/open-access-pivot/plan.md, docs/open-access-pivot/assessment.md, docs/open-access-pivot/lessons.md

Operational checklist. Items get ticked off as phases ship. Line references from the pre-build grep report (action log v62.1).

---

## Phase A1: Code removal — COMPLETE (2026-05-16, commit 1ac43a8)

### Files deleted entirely

- [x] `server/services/magic-link.service.ts`
- [x] `server/services/password-reset.service.ts`
- [x] `server/repositories/password-reset.repository.ts`
- [x] `client/src/pages/auth/login.tsx`
- [x] `client/src/pages/auth/forgot-password.tsx`
- [x] `client/src/pages/auth/reset-password.tsx`
- [x] `client/src/pages/auth/magic-link.tsx`
- [x] `client/src/pages/auth/link-expired.tsx`
- [x] `server/scripts/seed-admins.ts` (Adam: not needed; admin direct-add in Phase D handles this)
- [x] `server/scripts/seed-test-team-users.ts` (Adam: not needed)

### Files edited — methods removed

- [x] `server/services/auth.service.ts` — deleted `register()` and `login()`. Removed `bcrypt` import and `SALT_ROUNDS` constant.
- [x] `server/services/email.service.ts` — deleted `sendMagicLinkEmail`, `sendLegacyFreePeriodWarningEmail`, `sendLegacyFreePeriodTransitionEmail`
- [x] `server/repositories/users.repository.ts` — deleted `createSession`, `getSessionByToken`, `deleteSession`, `deleteExpiredSessions`. Removed `userSessions` import.
- [x] `server/repositories/team.repository.ts` — removed `passwordHash` from SELECT (line 177) and from filter (line 212). Removed `(clerkUserId OR passwordHash)` filter, kept just `clerkUserId IS NOT NULL`.
- [x] `server/cron/billing.cron.ts` — deleted monthly `community_free_months_remaining` decrement cron. Deleted legacy non-5D branch in 09:15 free-period cron.

### Routes deleted

- [x] `server/routes/auth.routes.ts`:
  - DELETED `POST /login`
  - DELETED `POST /forgot-password`
  - DELETED `POST /reset-password`
  - DELETED `POST /reset-password/validate` (if existed)
  - DELETED `POST /magic`
  - DELETED `POST /resend-magic-link`
- [x] `server/routes/admin.routes.ts`:
  - DELETED `POST /admin/verify-credentials`
  - DELETED `POST /admin/resend-magic-link`
- [x] `client/src/App.tsx`:
  - DELETED routes `/login`, `/forgot-password`, `/reset-password`, `/auth/magic`, `/auth/link-expired`
  - DELETED duplicate route registrations at lines 189–190
  - DELETED `/login` Redirect at line 192 (beta-era bookmark soft-landing, no longer needed)
  - Removed imports for Login, ForgotPassword, ResetPassword, MagicLinkPage, LinkExpiredPage

### Middleware env gates removed

- [x] `server/middleware/auth.ts` — stripped legacy session-fallback path in `isAuthenticated`. Unauth = 401, no DB lookup.
- [x] `server/middleware/clerk-auth.ts` — removed `CLERK_ENABLED` env gate in `tryClerkAuth`
- [x] `server/routes/webhooks.routes.ts` — removed `CLERK_ENABLED` check inside `revokeOrphanClerk`

### Dependencies removed

- [x] `package.json` — removed `bcrypt` and `@types/bcrypt`
- [x] `package-lock.json` confirmed clean after Replit Packager rebuild (note: direct `npm uninstall` failed in this Replit due to Nix Node PATH; recovery via Replit Packager UI took ~30 min. See lessons.md LN-001.)

### Account routes — bcrypt-dependent code

- [x] `server/routes/account.routes.ts` PATCH `/password` endpoint replaced with `410 Gone` redirect to Clerk's password management. Adam confirmed: delete legacy bcrypt path, surface Clerk UI instead.

### Client account page — legacy password change UI

- [x] `client/src/pages/account.tsx` — deleted lines 84-87 (useState for currentPassword/newPassword/confirmPassword), lines 124-135 (passwordMutation), lines 226-248 ("Change Password" Card). Kept lines 211-220 (Clerk-managed "Password and Security" Card).

### Admin database page — bcrypt re-auth gate

- [x] `client/src/pages/admin/database.tsx` — removed bcrypt re-auth gate (useState for `verified`/`email`/`password`/`authError`, `verifyMutation`, the credential-form early return). Page now renders seed buttons directly. Already gated at route level by AdminRoute → isSystemAdmin (App.tsx lines 145-182). Net safer: bcrypt re-auth was theatre on a route already locked down.

### A1 notes

- admin/database.tsx bcrypt re-auth gate also removed (not in original removals.md, added during apply). All 5 seed endpoints are idempotent (onConflictDoNothing / count-and-skip / upsert) and all 6 seed tables already populated in prod. Drop was safe.
- /login redirect at App.tsx:192 removed entirely (was a soft landing for old beta bookmarks; not needed).
- account.tsx legacy password change UI removed (lines 84-87, 124-135, 226-248). Clerk's own password management at lines 211-220 remains as the only password UI.
- Smoke tests after apply: Clerk sign-in ✓ / /account Clerk card ✓ / /admin/database access ✓

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

## Phase C-new: superseded surfaces (Stripe-first rework)

### To delete
- [ ] client/src/pages/welcome.tsx — entire file
- [ ] client/src/App.tsx — /welcome route + WelcomePage lazy import
- [ ] server/routes/public-signup.routes.ts — POST /signup handler
      (KEEP GET /promo/:slug ONLY IF marketing site needs benefit copy — decide C-new.1)
- [ ] client/src/pages/billing.tsx — the C.3c ?plan= highlight useEffect (moot)

### To modify (not delete)
- [ ] server/routes/webhooks.routes.ts handleUserCreated — REMOVE trial-creation
      block (createFiveDNewMemberTrial call, isFiveDNewMember branch, the
      existingSubscription===null trial logic). KEEP email match, clerkUserId
      link, invitation flip, seedDefaultPipelineStages, welcome email.
- [ ] server/routes/billing.routes.ts /verify-session — demote to read-only.
      DEFERRED out of C-new.3 (2026-05-17): own slice or Phase G hygiene.
      Idempotency-protected and not on the open-access path; demotion adds a
      billing.tsx eventual-consistency race to handle properly.

### To keep (confirmed still needed)
- useServerConfig.openAccessEnabled — launch flag, stays
- resolveCampaignBySlug — load-bearing for the new checkout endpoint
- All of Phase B promo model

### NEEDS CONFIRMATION before apply
- Exact location of the in-app multi-company "no subscription → blocked" gate
  — RESOLVED 2026-05-17: requireActiveSubscription on the /api/v2/user/companies
  mount in server/routes/index.ts. See plan.md "Multi-company gate".
- Whether createTrialSubscription / createFiveDNewMemberTrial have any
  remaining callers after C-new.4 (if none, candidates for A2 removal)
