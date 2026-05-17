# Open Access Pivot — Plan

Status: IN PROGRESS — C-new.1, C-new.2, C-new.3 built and dev-verified (2026-05-17). Next: C-new.4.
Started: 2026-05-15 (action log v62)
Owner: Adam
Related: assessment.md, removals.md, lessons.md, action log v62–v70

---

## What this pivot does

Valoxi today: admin invites users from a waitlist. After this pivot: marketing
site visitors self-serve. The signup flow is PAYMENT-FIRST (Stripe-first):
the visitor picks a plan, pays via Stripe Checkout, and the account is
provisioned from the verified Stripe webhook. Promo URLs apply a discount
coupon at checkout. Waitlist preserved as a soft option.

## Why Phase C was re-planned (2026-05-16)

Original Phase C built an account-first flow: /welcome form → create DB row →
Clerk signup → onboarding → billing wall → pay. Dev testing of that flow
exposed it as longer than necessary and produced a confusing "trial has ended"
state for users who never had a trial.

Decision: switch to Stripe-first (post-payment provisioning), the industry-
standard pattern for paid-first SaaS. The /welcome page and /public/signup
endpoint are redundant in this model — Stripe Checkout itself collects email
and name, and the DB row is created from the checkout.session.completed
webhook. See assessment.md "Stripe-first rework" for full rationale.

What survives from the original Phase C build:
- C.2 webhook work is PARTIALLY superseded — the trial-creation branch is
  removed entirely (Stripe owns subscriptions now); the email-match and
  clerkUserId-linking logic survives and simplifies.
- Phase B (promo model: slugs, dropped promo_codes) — fully stands.
- resolveCampaignBySlug (B.1b) — stands and is now load-bearing for checkout.

What is superseded:
- C.1: /public/signup endpoint — superseded (row creation moves to the webhook).
  GET /promo/:slug may survive for marketing benefit copy — TBD in C-new.1.
- C.3: /welcome page — superseded (Stripe Checkout replaces it).
  billing.tsx ?plan= highlight — moot (no /welcome to carry ?plan= from).
  useServerConfig.openAccessEnabled — survives as the launch flag.

## The Stripe-first flow (target state)

1. Marketing site tier card (+ optional ?promo=slug) → POST /api/v2/public/checkout
2. Public endpoint creates a Stripe Checkout Session: plan price + interval,
   coupon resolved from promo slug via resolveCampaignBySlug, client_reference_id
   set to a signup-intent token, success_url to /post-checkout?session_id=...
3. Stripe Checkout collects email + name + card. 5D New Member: a Stripe-native
   6-month trial gives the free period (£0, card still collected) with the
   15%-forever coupon attached from the start; at month 6 Stripe bills CORE at
   15%. Early Bird / Standard 5D: the campaign's forever-discount coupon is
   applied at checkout. No 100%-off coupon exists or is used.
4. checkout.session.completed webhook (signature-verified, idempotent):
   - Reads customer email from the session
   - Email-collision check (case-insensitive, mirrors Clerk webhook)
   - If no existing user: creates userCompany + user + userCompanyMembership
     in one transaction (mirrors admin-waitlist invite pattern)
   - Activates the subscription (existing activateSubscription path)
   - Attaches promo campaign to the user row if a promo was used
5. User redirected to /post-checkout — a polling page that waits for the
   webhook to finish provisioning, then forwards to Clerk with email pre-filled.
6. Clerk signup (password / Google / Microsoft). Clerk user.created webhook
   finds the now-existing row, links clerkUserId. If no match (wrong email):
   show "no account found for this email — did you pay with a different one?"
7. Onboarding (company name, industry, role, T&C, DPA, + marketing consent
   moved here from the old /welcome form).
8. Into the app with a live Stripe subscription. Multi-company add is
   unlocked because a subscription now exists.

## Phases

| Phase | Scope | Risk | Action log |
|---|---|---|---|
| Pre-build | grep baseline | None | v62 → v62.1 ✓ |
| A1 | Code residue removal | Low | v62.1 → v63 ✓ |
| B | Promo model: slugs, drop promo_codes | Low-Med | v63 → v64 ✓ |
| C-old | Account-first signup (SUPERSEDED) | — | built v64-v66, re-planned |
| C-new.1 | Public checkout endpoint POST /api/v2/public/checkout | Med | v67 ✓ built+verified |
| C-new.2 | Webhook self-serve provisioning from checkout.session.completed | High | v67.1 ✓ built+verified |
| C-new.3 | /post-checkout poll page + GET /api/v2/public/checkout-status | Med | v67.2 ✓ built+verified |
| C-new.4 | Clerk webhook simplification + email-mismatch message | Med | v67.2 → v67.3 |
| C-new.5 | Onboarding gains marketing consent | Low | v67.3 → v67.4 |
| C-new.6 | Retire /welcome, /public/signup, dead C.3 client bits | Low | v67.4 → v67.5 |
| flip OPEN_ACCESS_ENABLED | Soft launch | — | v67.5 → v67.6 |
| D | Admin direct add user | Low | v68 |
| F | 5D invoice rewrite | Low | v69 |
| A2 | Schema residue drop | Med | v70 |
| G | Hygiene + marketing site Stripe-bound CTAs | Low | v71 |
| E | Marketing site full overhaul | — | Deferred |

## Build progress — C-new (2026-05-17, dev-verified)

C-new.1, C-new.2, C-new.3 built, dev-verified against real signed Stripe
test-mode events, not committed to a release tag yet. Prod untouched.

Settled facts. Do not re-derive these:

5D mechanism is Option B-prime, NOT a 100%-off coupon.
- A 100%-off-6-months Stripe coupon does NOT exist and is not needed.
- 5D New Member checkout sets a Stripe-native 6-month trial and attaches the
  15%-forever coupon from day one. £0 during the trial, card collected. At
  month 6 Stripe ends the trial and bills CORE at 15%. Stripe owns the whole
  transition: no cron, no DB free-period row for new self-serve signups.
- A Stripe-first 5D user has subscriptions.free_months_total = 0; the free
  period lives entirely in the Stripe trial. The billing cron ignores them.
- 5D New Member self-serve is CORE + monthly only. PRO/EXPERT or annual with
  the 5d slug is rejected at the checkout endpoint.

Verified coupon IDs (Stripe TEST mode):
- cEGIKCtT — "5D New Member ongoing" — 15% off, forever
- 8GXzaftB — "Early Bird" — 20% off, forever
- YBzQWYzq — "Standard 5D community" — 15% off, forever
Campaign id 11 carries cEGIKCtT in BOTH stripe_coupon_id and
post_free_period_coupon_id; intentional, both stages use the same 15% coupon.
Live-mode coupon IDs are separate and confirmed at the prod cutover.
(Any earlier note citing BOWWbbs6 / t7DDiD9J / dIBdlJg2 was wrong: those IDs
do not exist. coupons.list in test mode returned only the three above.)

Collision behaviour (C-new.2): the webhook self-serve branch matches on email,
case-insensitive. Existing user with NO live subscription → activate against
their company (covers the 36 dormant invited users). Existing user who already
holds an active/trialing/admin_comped subscription → do NOT activate, do NOT
clobber, log DOUBLE-PAYMENT ALERT for manual review and refund. The new branch
returns non-2xx on failure so Stripe retries; email-collision + activate
idempotency make a retry converge.

Stripe v20 discount shape: a coupon on a subscription is read at
discount.source.coupon (string id), NOT discount.coupon. Anything that reads a
discount back off a subscription must use source.coupon.

Deferred out of C-new.3:
- /verify-session demotion — its own slice or Phase G hygiene. It is
  idempotency-protected and not on the open-access path; demoting it adds a
  billing.tsx eventual-consistency race that needs handling properly.
- Email-mismatch message — folded into C-new.4 (Clerk-webhook-coupled).

Future slice — 5D early-upgrade credit: when a 5D member upgrades mid free
period, carry the unused CORE value forward as a Stripe customer balance
credit, capped at the CORE 5D rate of $73.95/month. Built against
POST /api/v2/billing/upgrade, after C-new. Not in C-new scope.

## C-new.1: Public checkout endpoint

> Built and dev-verified 2026-05-17. As-built correction: there is NO
> 100%-off coupon. 5D New Member uses a Stripe-native 6-month trial plus the
> 15%-forever coupon. See "Build progress — C-new" above.

POST /api/v2/public/checkout — unauthenticated, rate-limited (waitlistLimiter).
Body: { planKey, interval, promoSlug? }
- Validates planKey in CORE/PROFESSIONAL/EXPERT, interval in month/year
- If promoSlug: resolveCampaignBySlug → campaign.stripeCouponId for the
  discount campaigns; for 5D New Member, a Stripe-native 6-month trial plus the
  15% coupon (NOT a 100%-off coupon)
- Creates Stripe Checkout Session:
  - mode: subscription, line_items: plan price from lookup key
  - discounts: [{ coupon }] if a promo resolved
  - metadata carries planKey / billingInterval / promoSlug (no signed token —
    the webhook signature authenticates the event)
  - success_url: {baseUrl}/post-checkout?session_id={CHECKOUT_SESSION_ID}
  - cancel_url: marketing site pricing section
- Returns { checkoutUrl }

## C-new.2: Webhook provisioning (HIGH RISK)

> Built and dev-verified 2026-05-17, against real signed Stripe events. HIGH
> RISK slice closed. See "Build progress — C-new" above.

Extend the existing checkout.session.completed branch in billing.routes.ts
(the billingWebhookRoutes handler). Current branch reads metadata.userCompanyId
and activates. New logic:
- If session has a userCompanyId (existing user upgrading) → current path, unchanged
- If NO userCompanyId (new self-serve buyer):
  - Read customer email from session.customer_details.email
  - Email-collision check against users (case-insensitive)
  - If existing active user → do NOT create a row; the subscription still
    activates against their company; log and continue
  - If no existing user → create userCompany + user + userCompanyMembership
    in a transaction (mirror admin-waitlist invite, companyName 'Pending Setup')
  - Resolve promo from session metadata → assignCampaignToUser
  - activateSubscription against the new userCompanyId
- Idempotency: the existing getEventByStripeId dedup covers webhook redelivery.
  The transaction must also be safe if the email already got a row from a
  concurrent event.

This is the highest-risk slice. Webhook is the SINGLE provisioning source.

## C-new.3: /post-checkout page + /verify-session demotion

> Built and dev-verified 2026-05-17. Scope as-built: the /post-checkout page +
> GET /api/v2/public/checkout-status endpoint ONLY. The /verify-session
> demotion and the email-mismatch message were split out — demotion deferred
> (own slice / Phase G), message moved to C-new.4. See "Build progress" above.

- New client page /post-checkout?session_id=... — polls a read-only endpoint
  ("has the webhook provisioned this session yet?"), shows a spinner, then
  forwards to Clerk /sign-up?email_address=... once provisioning is confirmed.
- /verify-session demotion: DEFERRED out of C-new.3. It must eventually become
  a read-only status check with no write/activate, so the webhook is the sole
  provisioner. Deferred because it is idempotency-protected, not on the
  open-access path, and demoting it adds a billing.tsx race to handle properly.
- Email-mismatch handling: MOVED to C-new.4. If the user reaches Clerk and
  signs up with a different email than they paid with, the Clerk webhook finds
  no row. Message: "We couldn't find an account for this email. Did you use a
  different email when you paid? Sign out and sign in with that email."

## C-new.4: Clerk webhook simplification

handleUserCreated in webhooks.routes.ts: REMOVE the entire trial-creation
block (createFiveDNewMemberTrial, the isFiveDNewMember branch, the
existingSubscription===null trial logic). Stripe owns subscription creation
now. The webhook keeps: email match, clerkUserId linking, invitation flip,
seedDefaultPipelineStages, welcome email, marketing sync.
billingService.createFiveDNewMemberTrial and createTrialSubscription become
unused by the signup path — leave defined (admin paths may use), or remove
in A2 cleanup. TBD.
Also in C-new.4: the email-mismatch message (moved here from C-new.3).

## C-new.5: Onboarding marketing consent

Add the GDPR marketing-consent checkbox (unchecked default) to the onboarding
form. It was on the old /welcome page; that page is gone. Onboarding is
post-Clerk so the consenting user is authenticated — cleaner for GDPR audit.

## C-new.6: Retire superseded surfaces

- Delete client/src/pages/welcome.tsx and its route in App.tsx
- Delete server/routes/public-signup.routes.ts (POST /public/signup) — OR keep
  GET /promo/:slug if the marketing site wants benefit copy. Decide at C-new.1.
- Remove billing.tsx ?plan= highlight effect (C.3c) — moot
- Keep useServerConfig.openAccessEnabled — it is the launch flag

## Multi-company gate — RESOLVED

Located: server/routes/index.ts, the requireActiveSubscription middleware on
the /api/v2/user/companies mount. It is not a multi-company-specific gate; it
gates ~20 route groups (the whole app). It keys on a subscriptions row existing
AND status in {active, trialing, admin_comped} (ACTIVE_STATUSES in
server/middleware/subscription.ts). The user-companies route handler itself has
no subscription check, only a hard cap of 5 companies.

Consequence for Stripe-first: satisfied for free, but C-new.2's
activateSubscription must write an active or trialing status. It does; a 5D
trial sub is trialing, a paid sub is active, both pass.

## Risk register

| # | Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|---|
| 1 | Webhook provisioning races a concurrent event, creates duplicate user | Med | High | Email-collision check inside the transaction; unique constraint on users.email; getEventByStripeId dedup. VERIFIED in C-new.2. |
| 2 | User pays with email A, signs into Clerk with email B → orphan-revoke kills the B Clerk account | Med | Low | Pre-fill Clerk email hard from Stripe email; clear copy; "no account found — wrong email?" message. Paid row is safe, only the wrong Clerk account is revoked. |
| 3 | Provisioning from browser redirect instead of webhook | n/a | High | Webhook is sole writer for the open-access flow. /verify-session demotion deferred (it is idempotency-protected and not on the open-access path). |
| 4 | 5D £0 checkout doesn't collect a card → no auto-continue | Med | Med | RESOLVED — Stripe Checkout in subscription mode collects a card even at £0. 5D verified: 184-day trial, card collected, 15% coupon attached. |
| 5 | OPEN_ACCESS_ENABLED flipped before C-new is ready | Low | Med | Flag defaults false |
| 6 | Marketing CTAs point at checkout before endpoint exists | Med | Low | Sequence: app side first, marketing CTAs in G |

## Open decisions

| # | Question | Resolved? |
|---|---|---|
| 1 | Keep GET /promo/:slug after /welcome retires? | TBD at C-new.6 |
| 2 | client_reference_id token format | RESOLVED — no token. planKey/billingInterval/promoSlug carried in Stripe session metadata; webhook signature already authenticates it. |
| 3 | Email-mismatch: message only, or also a recovery flow? | Message only for launch (risk 2 is low — paid row survives). Built in C-new.4. |
| 4 | createTrialSubscription / createFiveDNewMemberTrial — remove or leave? | Leave for now, revisit A2 |
| 5 | Multi-company gate exact location | RESOLVED — requireActiveSubscription on /api/v2/user/companies mount. See Multi-company gate section. |

## Action log progression

Actuals are dated and ticked. Rows below the C-new.3 line are projected.

| Version | Phase | Notes |
|---|---|---|
| v62 | Open access kickoff | Pivot scoped, 4-wave codebase assess completed |
| v62.1 | Pre-build complete ✓ | Replit grep pass + docs written + plan locked + 36-user investigation |
| v63 | A1 complete ✓ | Code residue removed (2026-05-16, commit 1ac43a8) |
| v64 | B complete ✓ | Promo model — slugs + drop promo_codes (see note below) |
| v64–v66 | C-old (superseded) | Account-first signup built, then re-planned to Stripe-first |
| v67 | C-new.1 complete ✓ | Public checkout endpoint (2026-05-17, dev-verified) |
| v67.1 | C-new.2 complete ✓ | Webhook self-serve provisioning (2026-05-17, dev-verified incl. collision guard) |
| v67.2 | C-new.3 complete ✓ | /post-checkout page + checkout-status endpoint (2026-05-17, dev-verified) |
| v67.3 | C-new.4 (next) | Clerk webhook simplification + email-mismatch message |
| v67.4 | C-new.5 (projected) | Onboarding gains marketing consent |
| v67.5 | C-new.6 (projected) | Retire /welcome, /public/signup, dead C.3 client bits |
| v67.6 | flip OPEN_ACCESS_ENABLED (projected) | Soft launch |
| v68–v71 | D, F, A2, G (projected) | Admin direct add, 5D invoice rewrite, schema drop, hygiene |
| later | E (projected) | Marketing site full overhaul (separate workstream) |

Note on Phase B: this phase table marks B complete (✓). The removals.md Phase B
checklist is still unticked. Confirm B's true state and reconcile the two docs.