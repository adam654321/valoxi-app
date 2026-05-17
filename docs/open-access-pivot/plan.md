# Open Access Pivot — Plan

Status: IN PROGRESS — Phase C RE-PLANNED (Stripe-first rework)
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
3. Stripe Checkout collects email + name + card. 5D coupon = 100% off 6 months,
   so 5D pays £0 today but still enters card (subscription auto-continues month 7).
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
| C-new.1 | Public checkout endpoint + Stripe session creation | Med | v66 → v67 |
| C-new.2 | Webhook provisioning: create user from checkout.session.completed | High | v67 → v67.1 |
| C-new.3 | /post-checkout poll page + Clerk forward + email-mismatch handling | Med | v67.1 → v67.2 |
| C-new.4 | Clerk webhook simplification (strip trial creation) | Med | v67.2 → v67.3 |
| C-new.5 | Onboarding gains marketing consent | Low | v67.3 → v67.4 |
| C-new.6 | Retire /welcome, /public/signup, dead C.3 client bits | Low | v67.4 → v67.5 |
| flip OPEN_ACCESS_ENABLED | Soft launch | — | v67.5 → v67.6 |
| D | Admin direct add user | Low | v68 |
| F | 5D invoice rewrite | Low | v69 |
| A2 | Schema residue drop | Med | v70 |
| G | Hygiene + marketing site Stripe-bound CTAs | Low | v71 |
| E | Marketing site full overhaul | — | Deferred |

## C-new.1: Public checkout endpoint

POST /api/v2/public/checkout — unauthenticated, rate-limited (waitlistLimiter).
Body: { planKey, interval, promoSlug? }
- Validates planKey in CORE/PROFESSIONAL/EXPERT, interval in month/year
- If promoSlug: resolveCampaignBySlug → campaign.stripeCouponId for the
  discount campaigns; for 5D New Member, the 100%-off-6-months coupon
- Creates Stripe Checkout Session:
  - mode: subscription, line_items: plan price from lookup key
  - discounts: [{ coupon }] if a promo resolved
  - client_reference_id: a generated signup-intent token (carries promo slug
    + plan so the webhook can attribute without trusting metadata alone)
  - success_url: {baseUrl}/post-checkout?session_id={CHECKOUT_SESSION_ID}
  - cancel_url: marketing site pricing section
- Returns { checkoutUrl }
NEEDS CONFIRMATION: how 5D's £0 checkout behaves — confirm the 100%-off coupon
is a 6-month duration:repeating coupon and that Stripe still collects a card in
that case (it should, for the auto-continue).

## C-new.2: Webhook provisioning (HIGH RISK)

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
  - Resolve promo from client_reference_id token → assignCampaignToUser
  - activateSubscription against the new userCompanyId
- Idempotency: the existing getEventByStripeId dedup covers webhook redelivery.
  The transaction must also be safe if the email already got a row from a
  concurrent event.

This is the highest-risk slice. Webhook is the SINGLE provisioning source.
/verify-session must be demoted to read-only (see C-new.3).

## C-new.3: /post-checkout page + /verify-session demotion

- New client page /post-checkout?session_id=... — polls a read-only endpoint
  ("has the webhook provisioned this session yet?"), shows a spinner, then
  forwards to Clerk /sign-up?email_address=... once provisioning is confirmed.
- /verify-session is DEMOTED: it must no longer write/activate. It becomes a
  read-only status check. Provisioning is the webhook's job exclusively.
  This removes the current double-provisioning (webhook + browser redirect).
- Email-mismatch handling: if the user reaches Clerk and signs up with a
  different email than they paid with, the Clerk webhook finds no row.
  Message: "We couldn't find an account for this email. Did you use a
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

## Multi-company gate — resolved as a consequence

Today: in-app, a user with no subscription is blocked from adding companies.
NEEDS CONFIRMATION: exact location of that gate in the fresh extract.
In Stripe-first, every user has a subscription from checkout completion, so
the gate is naturally satisfied. No code change needed — but confirm the gate
keys on "subscription exists" and not on some other flag.

## Risk register

| # | Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|---|
| 1 | Webhook provisioning races a concurrent event, creates duplicate user | Med | High | Email-collision check inside the transaction; unique constraint on users.email; getEventByStripeId dedup |
| 2 | User pays with email A, signs into Clerk with email B → orphan-revoke kills the B Clerk account | Med | Low | Pre-fill Clerk email hard from Stripe email; clear copy; "no account found — wrong email?" message. Paid row is safe, only the wrong Clerk account is revoked. |
| 3 | Provisioning from browser redirect instead of webhook | n/a | High | C-new.3 demotes /verify-session to read-only; webhook is sole writer |
| 4 | 5D £0 checkout doesn't collect a card → no auto-continue | Med | Med | Confirm coupon config in C-new.1; Stripe Checkout in subscription mode collects card even at £0 |
| 5 | OPEN_ACCESS_ENABLED flipped before C-new is ready | Low | Med | Flag defaults false |
| 6 | Marketing CTAs point at checkout before endpoint exists | Med | Low | Sequence: app side first, marketing CTAs in G |

## Open decisions

| # | Question | Resolved? |
|---|---|---|
| 1 | Keep GET /promo/:slug after /welcome retires? | TBD at C-new.1 |
| 2 | client_reference_id token format | TBD — short signed token carrying promo slug |
| 3 | Email-mismatch: message only, or also a recovery flow? | Message only for launch (risk 2 is low — paid row survives) |
| 4 | createTrialSubscription / createFiveDNewMemberTrial — remove or leave? | Leave for now, revisit A2 |
| 5 | Multi-company gate exact location | NEEDS CONFIRMATION in fresh extract |

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