# Open Access Pivot — Plan

Status: IN PROGRESS. C-new build block COMPLETE and C-new functional test pass
COMPLETE on dev (3 runs passed, one collision-flow finding surfaced). Launch
model changed 2026-05-18: this is now a COORDINATED FULL LAUNCH, not a soft
launch. The marketing site switch and the app flip happen together as one
event. Next: the launch block (collision-flow fix, flag relocation, CORS,
marketing checkout build), then the coordinated release.
Started: 2026-05-15 (action log v62)
Owner: Adam
Related: assessment.md, removals.md, lessons.md, functional-test.md, action log v62+

---

## What this pivot does

Valoxi today: admin invites users from a waitlist. After this pivot: marketing
site visitors self-serve. The signup flow is PAYMENT-FIRST (Stripe-first):
the visitor picks a plan, pays via Stripe Checkout, and the account is
provisioned from the verified Stripe webhook. Promo URLs apply a discount
coupon at checkout.

The waitlist is REMOVED at launch (changed 2026-05-18 — it was previously to
be preserved as a soft option). A contact route replaces it as the soft
contact path for visitors not ready to buy.

## Launch model — changed 2026-05-18

The original plan staged the launch as two events: first flip
OPEN_ACCESS_ENABLED (a soft launch — marketing site still on the waitlist,
checkout reachable only by a direct promo link), then later, in Phase G,
repoint the marketing CTAs and retire the waitlist.

Adam's decision 2026-05-18: collapse this into ONE event. The marketing site
switch and the app flip happen together. At launch the marketing site routes
its tier cards to Stripe Checkout and the waitlist is off.

Consequences, all now baked into the sequence below:

- The marketing checkout path is a BUILD, not the href change Phase G
  assumed. It is in the critical path to launch.
- The collision-flow fix (see below) is a HARD launch blocker. A coordinated
  launch means organic traffic, which means organic double-payment collisions
  from minute one. A paid-plan collision is a recurring orphaned Stripe charge.
- Promo distribution at launch: direct promo URLs (?promo=slug) held by
  Valoxi and shared with whoever is being given the discount. The standard
  self-serve path is the marketing tier cards into checkout with no promo.

## Flag sync — pull model (settled design 2026-05-18)

OPEN_ACCESS_ENABLED is a SINGLE source of truth, held in the app. The
marketing site does NOT store its own copy and there is no app-to-marketing
webhook. The marketing site reads the flag at request time from the app's
existing public config endpoint (the same endpoint useServerConfig reads).

Rationale: a webhook would push state into a second store (Cloudflare KV or
similar), and two copies of one boolean is the drift this is meant to avoid —
one failed delivery and they sit out of sync. A pull has one copy, so "always
in line" is not a mechanism to maintain, it is simply true.

Behaviour: marketing renders the waitlist when the flag is false, the checkout
path when true. FAIL CLOSED — if the config fetch fails, render the waitlist,
never checkout.

The flag MOVES from an env var to a system_config row with an admin settings
toggle (slice C-new.9), so flipping is a click in the admin UI, no redeploy.
The config endpoint serves the live value either way. Flipping the toggle is
the single launch action: it switches the app and, via the pull, the marketing
site at the same time. Flipping back reverts both.

## The Stripe-first flow (target state)

1. Marketing site tier card (+ optional ?promo=slug) -> POST /api/v2/public/checkout
2. Public endpoint creates a Stripe Checkout Session: plan price + interval,
   coupon resolved from promo slug via resolveCampaignBySlug, success_url to
   /post-checkout?session_id=... Checkout data carried in Stripe session
   metadata (planKey/billingInterval/promoSlug); no signed token — the webhook
   signature authenticates the event.
3. Stripe Checkout collects email + name + card. 5D New Member: a Stripe-native
   6-month trial gives the free period (£0, card still collected) with the
   15%-forever coupon attached from the start; at month 6 Stripe bills CORE at
   15%. Early Bird / Standard 5D: the campaign's forever-discount coupon is
   applied at checkout. No 100%-off coupon exists or is used.
4. checkout.session.completed webhook (signature-verified, idempotent):
   - Reads customer email from the session
   - Email-collision check (case-insensitive, mirrors Clerk webhook)
   - If no existing user: creates userCompany + user + userCompanyMembership
     in one transaction; activates the subscription; attaches promo campaign
   - If an existing user already holds a live subscription: DOUBLE-PAYMENT
     ALERT, no provisioning, existing row untouched (manual review + refund)
5. User redirected to /post-checkout — a polling page that waits for the
   webhook to finish provisioning, then shows an email-confirm interstitial
   before forwarding to Clerk with that email pre-filled.
6. Clerk signup. Clerk user.created webhook finds the now-existing row, links
   clerkUserId. handleUserCreated no longer creates a subscription.
7. Onboarding (company name, industry, role, T&C, DPA, + marketing consent).
8. Into the app with a live Stripe subscription.

---

## Phases

| Phase | Scope | Risk | Status |
|---|---|---|---|
| Pre-build | grep baseline | None | v62 → v62.1 ✓ |
| A1 | Code residue removal | Low | v62.1 → v63 ✓ |
| B | Promo model: slugs, drop promo_codes | Low-Med | v63 → v64 ✓ |
| C-old | Account-first signup (SUPERSEDED) | — | re-planned |
| C-new.1 | Public checkout endpoint | Med | v64 ✓ |
| C-new.2 | Webhook self-serve provisioning | High | v64 ✓ |
| C-new.3 | /post-checkout poll page + status endpoint | Med | v64 ✓ |
| C-new.4 | Clerk webhook simplification | Med | v65 ✓ |
| C-new.4b | /post-checkout email-confirm interstitial | Low | v65 ✓ |
| C-new.5 | Onboarding marketing consent | Low | v65 ✓ |
| C-new.5b | Marketing sync honours consent | Low | v65 ✓ |
| C-new.6 | Retire superseded signup surfaces | Low | v65 ✓ |
| C-new functional test | E2E pass on dev, 3 runs | — | v66 ✓ collision finding surfaced |
| **LAUNCH BLOCK — critical path to launch** | | | |
| C-new.7a | Post-checkout collision fix (app) | Med | v66 ✓ |
| C-new.7b | Admin collision filter on /admin/webhook-events (app) | Low | v66 ✓ |
| C-new.8 | CORS on public endpoints — checkout + config (app) | Med | v66 ✓ |
| C-new.9 | OPEN_ACCESS_ENABLED -> system_config + admin settings toggle (app) | Med | v66 ✓ |
| C-new.9a | system_config read cache with cache-bust-on-write (app) | Low | next |
| M.1 | valoxi-site assess (PricingToggle, /pricing, waitlist form, CF functions) | None | launch block |
| M.2 | Marketing tier cards -> app checkout endpoint | Med | launch block |
| M.3 | Flag-aware rendering (pull from app config) + waitlist off | Med | launch block |
| M.4 | Contact route (replaces waitlist as soft contact) | Low | launch block |
| Launch test pass | Full E2E: marketing local + app, flag on | — | launch block |
| LAUNCH | Coordinated release: marketing deploy + flag on, together | High | after test pass |
| **POST-LAUNCH** | | | |
| D | Admin direct add user | Low | post-launch |
| F | 5D invoice rewrite | Low | post-launch |
| A2 | Schema residue drop | Med | post-launch |
| G | Hygiene + promo-distribution remainder | Low | post-launch |
| E | Marketing site full overhaul | — | deferred, separate workstream |

Scope discipline: the M.* slices are the FUNCTIONAL checkout path only — tier
cards to checkout, flag-aware rendering, waitlist off, a contact route. They
are NOT Phase E (hero rewrite, design pass). Phase E stays deferred. Letting
"one event" pull the redesign forward would run the launch date away.

## Critical path to launch

Ordered. App slices and marketing slices can overlap; the launch test pass
needs all of them landed.

App (Replit, architect/relay model):
1. C-new.7a — post-checkout collision fix. DONE v66.
2. C-new.7b — admin collision filter on /admin/webhook-events. DONE v66.
3. C-new.8 — CORS on the public checkout and public config endpoints. DONE v66.
4. C-new.9 — relocate OPEN_ACCESS_ENABLED to system_config, add the admin
   settings toggle. DONE v66.
5. C-new.9a — system_config read cache with cache-bust-on-write. Split out of
   C-new.9 deliberately: the cache is a generic change to getConfig (affects
   all config keys) and carries an invalidation requirement (setConfig must
   bust the cache so an admin flip is instant). Kept off the launch-switch
   slice so C-new.9's diff stayed small and provable. C-new.9 ships a correct
   launch switch; 9a optimises the read path before the marketing site pulls
   the flag at volume.

Marketing site (valoxi-site, edited directly via filesystem, Adam commits/pushes):
6. M.1 — assess valoxi-site.
7. M.2 — tier cards to the app checkout endpoint.
8. M.3 — flag-aware rendering (pull the flag from the app config endpoint),
   waitlist off when the flag is on, fail closed.
9. M.4 — contact route.

Then:
10. Launch test pass — full E2E on dev with the flag on, marketing site running
    locally against the dev app: tier card -> checkout -> webhook provision ->
    /post-checkout -> Clerk -> onboarding -> into the app; collision path;
    waitlist-off rendering.
11. LAUNCH — deploy the updated marketing site DORMANT (flag still false, it
    renders the waitlist), then flip the admin toggle. The flip is the launch.

---

## Build progress — C-new (2026-05-17, dev-verified)

C-new.1 through C-new.6 built and dev-verified. C-new.1/.2/.3 verified against
real signed Stripe test-mode events. C-new.4/.4b/.5/.5b/.6 each ran the
assess -> apply -> V-check cycle. TSC baseline held at exactly 1 pre-existing
error (portal.service.ts:81) throughout. Prod untouched, no release tag.

Commits: C-new.4 ff05253, C-new.4b a9c2e76, C-new.5 fb32304, C-new.5b 2ee367f,
C-new.6 auto-checkpoints 8681f52 + 76a87e8.

## C-new functional test pass — COMPLETE (2026-05-17/18, v66)

Three runs on dev, all passed. Full detail in functional-test.md.

- Run A — 5D trial path. Trialing sub, 184-day Stripe trial, cEGIKCtT coupon,
  free_months_total 0, consent ticked -> Resend unsubscribed false, in the
  TRIALING segment, 10 pipeline stages visible.
- Run B — paid path. Active sub, no trial, consent unticked -> Resend
  unsubscribed true, in the ACTIVE_SUBSCRIBERS segment, 10 stages visible.
- Run C — collision. DOUBLE-PAYMENT ALERT logged, no provisioning, the
  existing user untouched. Guard objective met.

Both webhook branches verified, consent honoured both directions (C-new.5b
verified both ways), segmentation correct for both flows, collision guard
fired.

### Collision-flow finding (drives C-new.7a and C-new.7b)

Run C surfaced a gap between the webhook guard (C-new.2) and /post-checkout
(C-new.3/.4b) — built as separate slices, the seam untested until the
functional pass.

The webhook collision guard works: a double payment is refused, no second
subscription is attached, the existing row is untouched. Money and data are
safe. But:

1. /post-checkout shows false success. checkout-status returns provisioned
   based purely on whether a users row exists for the email. A collision email
   always exists, so checkout-status always returns provisioned true and
   /post-checkout renders "your account is ready" and walks the user into
   Clerk signup, even though the payment was refused. No collision branch
   exists in the page.
2. No ops alert. The 08:00 webhook-failure cron queries Stripe for
   delivery_success:false; a collision was delivered fine (HTTP 200), so it is
   invisible to that cron. The DOUBLE-PAYMENT ALERT is a console line plus
   webhook_events.error = 'duplicate_checkout_existing_subscription' and
   nothing surfaces it. The plan's "manual review and refund" has no trigger.
3. The refused payment is a real Stripe subscription. For a paid plan it
   recurs monthly — an orphaned recurring charge with nobody watching, given
   point 2.

C-new.7a fixes the flow: checkout-status correlates the session to its
webhook_events row and returns a real state (provisioned / pending /
collision) plus whether the existing user has a Clerk account; /post-checkout
gains a collision branch with honest copy, routing to sign-IN if the user has
Clerk, sign-UP if not. DONE v66, dev-verified by a live collision retest
(functional-test.md, C-new.7a retest).

C-new.7b adds the admin surface. Scope revised 2026-05-18: Option 1 only — a
"collisions only" filter and red highlight on the existing /admin/webhook-events
page, showing the colliding email and the refused Stripe sub id inline. The
in-app admin notification (the original Q2 answer) is DROPPED from 7b to
post-launch: the only push option that does not hack the per-user, tenant-scoped
team_notifications table is a fresh admin-alert build, not worth extending the
critical path for a rare event. The launch blocker was collision INVISIBILITY,
and the filter closes that. DONE v66, dev-verified live. The in-app admin
notification is logged as a post-launch admin-hygiene item.

Auto-cancel of the orphaned Stripe sub is deliberately NOT done — manual review
and refund stays, but now with a trigger (the webhook-events collision filter).

## Settled facts. Do not re-derive these.

5D mechanism is Option B-prime, NOT a 100%-off coupon.
- 5D New Member checkout sets a Stripe-native 6-month trial and attaches the
  15%-forever coupon (cEGIKCtT) from day one. £0 during the trial, card
  collected. At month 6 Stripe ends the trial and bills CORE at 15%.
- A Stripe-first 5D user has subscriptions.free_months_total = 0; the free
  period lives entirely in the Stripe trial. The billing cron ignores them.
- 5D New Member self-serve is CORE + monthly only.

Verified coupon IDs (Stripe TEST mode):
- cEGIKCtT — 5D New Member ongoing — 15% off, forever (campaign 11, slug `5d`)
- 8GXzaftB — Early Bird — 20% off, forever (campaign 10, slug `early-bird`)
- YBzQWYzq — Standard 5D community — 15% off, forever (campaign 9, slug `5d-community`)
Live-mode coupon IDs are separate, confirmed at the prod cutover.

Multi-company gate = requireActiveSubscription middleware on the
/api/v2/user/companies mount in server/routes/index.ts. Status in
{active, trialing, admin_comped}. Not company-specific — gates ~20 route groups.
Satisfied for free by C-new.2's activateSubscription.

Stripe v20 discount shape: a subscription's coupon is at
discount.source.coupon (string id), NOT discount.coupon.

Checkout dedup is getEventByStripeId against webhook_events.stripe_event_id
(NOT subscription_events — the comment at billing.routes.ts:471 and the
assessment.md Stripe section are stale, Phase G doc hygiene). checkout.session
.completed does not write subscription_events; that table is post-provisioning
billing transitions only.

pipeline_stages is a GLOBAL table (no company FK), idempotently seeded. Dev
and prod both already hold the 10 default rows. C-new functional test Run A/B
confirmed a fresh self-serve user sees all 10.

createTrialSubscription and createFiveDNewMemberTrial both have 0 callers
after C-new.4. Definitions left in billing.service.ts as A2 removal candidates.

handleUserCreated no longer creates subscriptions. Stripe is the sole
provisioner. The Clerk webhook only links the account.

Email-mismatch is prevented at the /post-checkout interstitial (C-new.4b).
AccountSetupPending is NOT reachable on the orphan-revoke path.

## Multi-company gate — RESOLVED

requireActiveSubscription on the /api/v2/user/companies mount in
server/routes/index.ts, status in {active, trialing, admin_comped}. Universal
app entitlement gate, ~20 route groups. Stripe-first satisfies it for free.

## Risk register

| # | Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|---|
| 1 | Webhook provisioning races a concurrent event, duplicate user | Med | High | Email-collision check in the transaction; unique constraint on users.email; getEventByStripeId dedup. VERIFIED C-new.2 + functional test. |
| 2 | User pays with email A, signs into Clerk with email B | Med | Low | C-new.4b interstitial shows the paid email before the Clerk handoff. |
| 3 | Provisioning from browser redirect instead of webhook | n/a | High | Webhook is sole writer. /verify-session demotion deferred. |
| 4 | 5D £0 checkout doesn't collect a card | Med | Med | RESOLVED — Stripe Checkout subscription mode collects a card at £0. Verified. |
| 5 | Flag flipped before the launch block is ready | Low | Med | Flag defaults false. The flip is gated on the launch test pass, which includes the collision fix. |
| 6 | Coordinated release ordering — marketing live but flag false, or flag on but marketing stale | Med | Med | Marketing ships DORMANT and flag-aware: deploy it while the flag is false (renders waitlist), then flip the toggle as the single launch action. |
| 7 | CORS misconfigured on the public endpoints | Med | Med | Explicit allowed origin (valoxi.ai), not wildcard. Checkout AND config endpoints. C-new.8. Getting it wrong either breaks the marketing site or over-opens the endpoints. |
| 8 | Cloudflare edge cache freezes the flag at deploy-time value | Med | Med | The flag-dependent marketing rendering must be dynamic or short-TTL so a flip takes effect. M.3 assess must confirm. |
| 9 | Marketing config fetch fails -> site renders checkout when it should not | Low | Med | Fail closed: on any config fetch failure render the waitlist, never checkout. M.3. |
| 10 | Double-payment collision goes unnoticed (paid-plan orphaned recurring charge) | Med | Med | C-new.7b surfaces collisions to admin (UI + in-app notification). Manual review and refund, now with a trigger. |

## Open decisions

| # | Question | Resolved? |
|---|---|---|
| 1-5 | (earlier C-new decisions) | RESOLVED — see action log / handover |
| 6 | Flag sync mechanism app <-> marketing | RESOLVED 2026-05-18 — pull model, marketing reads the app config endpoint, no webhook, no second copy |
| 7 | Flip ergonomics — env var or admin toggle | RESOLVED 2026-05-18 — system_config row + admin settings toggle (C-new.9) |
| 8 | Launch staging — soft launch then marketing, or one event | RESOLVED 2026-05-18 — one coordinated event |
| 9 | Advertised promo code (typed code, e.g. an ad saying "use code X") | PARKED, post-launch. The slug model advertises a URL (?promo=slug), not a typed code. A typed-code box at checkout needs allow_promotion_codes:true, which Phase C deliberately sets false. Revisit as a separate decision after launch. |
| 10 | Contact route — what form, where | M.4 scope. Replaces the waitlist as the soft contact path. Decide the form fields at M.1/M.4. |
| 11 | In-app admin notification for collisions | PARKED, post-launch admin-hygiene item. 7b scoped to the webhook-events filter only (Option 1). A push notification needs a fresh admin-alert surface — team_notifications is per-user and tenant-scoped, reusing it is a hack. Pairs with Phase G or a small admin-hygiene slice. |

## Outstanding before launch

The launch is gated on the launch block (C-new.7a/.7b/.8/.9 + M.1-M.4)
completing and the launch test pass passing. The launch test pass must cover:
- Full E2E with the flag on: tier card -> checkout -> webhook provision ->
  /post-checkout -> Clerk -> onboarding -> into the app with a live sub.
- The collision path: /post-checkout shows the collision state, routes
  correctly, the admin collision filter shows the row.
- Flag-aware marketing rendering: waitlist when off, checkout when on, fail
  closed on config fetch failure.
- CORS: a real cross-origin POST from the marketing site to the checkout
  endpoint succeeds.
- Webhook reachability to dev is a prerequisite. Use fresh adam+ aliases.

Prod cutover checklist (C-new.8 dependency): MARKETING_SITE_URL must be
confirmed set correctly in the prod environment. C-new.8's CORS allowed origin
derives from it; the dev box runs on the 'https://valoxi.ai' default. If prod
needs a different origin it must be set explicitly before the flip.

## Action log progression

| Version | Phase | Notes |
|---|---|---|
| v62 | Open access kickoff | Pivot scoped, 4-wave codebase assess |
| v62.1 | Pre-build complete ✓ | Replit grep pass + docs + 36-user investigation |
| v63 | A1 complete ✓ | Code residue removed (commit 1ac43a8) |
| v64 | B + C-new.1/.2/.3 ✓ | Promo model; checkout endpoint; webhook provisioning; /post-checkout |
| v65 | C-new.4/.4b/.5/.5b/.6 ✓ | C-new build block closed on dev |
| v66 | C-new functional test pass ✓ | 3 runs passed; collision-flow finding surfaced; launch model changed to coordinated |
| next | Launch block | C-new.7a/.7b/.8/.9 + M.1-M.4, then launch test pass |
| next | LAUNCH | Coordinated release: marketing deploy + flag on |
| later | D, F, A2, G | Post-launch |
| later | E | Marketing site full overhaul (separate workstream) |