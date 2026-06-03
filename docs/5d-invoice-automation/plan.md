# 5D Invoice Automation — Plan

Status: IN PROGRESS. Sub-build 1 (assess) COMPLETE on dev/prod inspection.
Invoice selection model LOCKED 2026-06-03. Next: the invoice-rebuild slice
(was not in the original handover scope — see "Scope correction" below), then
the auto-send cron, then the admin override UI.
Started: 2026-06-03 (action log v70+)
Owner: Adam
Related: assessment.md, removals.md, docs/open-access-pivot/* (A2 schema drops)

---

## What this workstream does

Automates the monthly partner invoice for the 5D New Member subsidy. A 5D New
Member gets a 6-month free period (the Stripe-native trial); during that period
the 5D partner pays Valoxi $73.95 per member per month. The invoice gathers the
billable members for a given month, renders the amount, and (sub-build 2) emails
the partner contact on a schedule, with an audit trail and idempotency.

## Scope correction (2026-06-03)

The handover framed this as "the invoice page mostly works, just convert it to a
sendable email." The sub-build 1 assess disproved that:

- The invoice query sits on the DEAD pre-pivot data model. It filters
  `subscriptions.referral_source = '5d_community' AND free_months_total > 0 AND
  free_months_started_at IS NOT NULL`. No live Stripe-first signup writes any of
  those three fields. The query returns 2 legacy prod rows and zero real members.
- The rate is wrong and divergent. Server computes at `INVOICE_RATE = 50.25`
  (admin.routes.ts:382); client displays `73.95` (referral-invoice.tsx:11).
  Correct is $73.95. No money has moved only because the query returns the wrong
  cohort.

Consequence: there is a build slice the handover did not anticipate — rebuild the
invoice query onto the live data model and consolidate the rate — and it must
land BEFORE the cron, because the cron renders this invoice.

## The corrected sub-build sequence

| # | Slice | Status |
|---|---|---|
| 1 | ASSESS attribution + invoice state (read-only) | COMPLETE 2026-06-03 |
| 1b | REBUILD invoice query onto the live model + consolidate rate | next |
| 2 | Auto-send cron, 7th of month 04:00 UK, idempotent, audit row | after 1b |
| 3 | Admin override (mark invoiced / resend / view history) UI | after 2 |

## Invoice selection model — LOCKED 2026-06-03

Confirmed against two independent live Stripe-first signups (user 110, 20 May;
user 112, 03 June), both clean "Shape B" (see assessment.md).

- Cohort: users whose `users.assigned_promo_campaign_id` points at a campaign
  with `promo_code_campaigns.free_months_total > 0`. Campaign 11 today; campaign
  9 (value 0) correctly excluded; not hardcoded to id 11, so future billable
  campaigns are picked up automatically.
- Free-period window per member:
  - start = `COALESCE(subscriptions.trial_start, subscriptions.created_at)`
    (Shape B has `trial_start` NULL, so it uses `created_at`, which is within
    seconds of the real signup time)
  - end = start + campaign `free_months_total` months
- Billable for invoice month M: the window overlaps M.
- Cancelled members: billable for months consumed up to `canceled_at`, NOT the
  full entitlement, NOT excluded.
- Rate: one constant, $73.95 = 7395 cents = $87 CORE x 0.85. Reuse the planned
  `config.billing.coreMonthlyDiscountedCents` home (see open-access removals.md
  Phase G) so this consolidates rather than adding a fourth literal.
- The model IGNORES `subscriptions.free_months_total`, `free_months_started_at`,
  and `referral_source` entirely. Those are dead-by-design on the live path and
  are A2 drop candidates. Reading entitlement off the CAMPAIGN row, not the
  subscription row, is what lets one model serve both data shapes with no branch.

## Settled facts. Do not re-derive these.

- Billable 5D campaign = id 11, slug `5d`, "5D New Member", `free_months_total = 6`.
  Campaign 9 (`5d-community`, `free_months_total = 0`) is forever-discount only,
  NOT billable.
- Coupons: campaign 11 test-mode `cEGIKCtT`, live-mode `dIBdlJg2`. Campaign 11
  also carries `post_free_period_coupon_id = dIBdlJg2` (same coupon continues
  after the free period). 15% off forever.
- Live Stripe-first 5D row = Shape B: `assigned_promo_campaign_id = 11`,
  `free_months_total = 0`, `free_months_started_at` NULL, `trial_start` NULL,
  `trial_end` NULL, `current_period_end` ~6 months out, `stripe_subscription_id`
  present, `status = trialing`, `plan_key = CORE`, `billing_interval = month`.
- `free_months_total = 0` on a live 5D row is CORRECT by design, not a bug. The
  free period lives entirely in the Stripe trial; the DB free-months cron is
  retired.
- Rate = $73.95/member/month. Stale literal is `INVOICE_RATE = 50.25` at
  admin.routes.ts:382. Client literal `73.95` at referral-invoice.tsx:11.
  `INVOICE_RATE_CENTS = 7395` in billing.routes.ts is a SEPARATE purpose (Stripe
  balance-credit on early conversion), not the invoice rate. Do not conflate.
- `current_period_end` equals the Stripe trial end ONLY while `status = trialing`.
  It rolls forward once the sub converts to active. Do NOT key the free-period
  window off it. Compute the window from campaign entitlement + a stable start.

## Risk register

| # | Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|---|
| 1 | Invoice keyed on `current_period_end` breaks the month a member converts | Med | High | Window computed from entitlement + COALESCE(trial_start, created_at), never from current_period_end. LOCKED in the model. |
| 2 | Prod test rows (pre-cutover) appear on a real partner invoice once the query keys on campaign 11 | High | High | Purge prod test rows before go-live. See removals.md. No real users on live yet (Adam confirmed). |
| 3 | Cron double-sends for the same period | Med | Med | Idempotent on a subscription_events audit row keyed (user_id, billing_period_yyyymm). Sub-build 2. |
| 4 | Cancelled member over- or under-billed | Med | Med | Cap billable months at canceled_at. LOCKED in the model. |
| 5 | Rate stays divergent server vs client | resolved at 1b | Med | Single config constant; both surfaces read it. |

## Open decisions

| # | Question | Resolved? |
|---|---|---|
| 1 | Partner contact email for the invoice send | OPEN — Dee to confirm. Currently believed to go to herself. Decide before sub-build 2. |
| 2 | Whether to fold the #99 "referral_source NULL" item in | RESOLVED 2026-06-03 — #99 is a symptom of the dead model, not a NULL-population bug. The rebuild routes around referral_source entirely. Do NOT back-populate it. Column drops in A2. |
| 3 | Annual-interval 5D | Out of scope. 5D New Member self-serve is CORE + monthly only (settled fact, open-access). |

## Action log progression

| Version | Slice | Notes |
|---|---|---|
| v70+ | Sub-build 1 assess | Attribution-broken finding; two-shape finding; rate bug; model locked |
| next | 1b invoice rebuild | Query onto live model, rate consolidation |
| later | 2 cron, 3 admin UI | |