# 5D Invoice Automation — Plan

Status: IN PROGRESS. Sub-build 1 (assess) and sub-build 1b (invoice rebuild)
COMPLETE and proven on dev 2026-06-03. Billing model is UPFRONT (corrected
2026-06-03 — see "Billing model correction"). Next: sub-build 2 (auto-send
cron), then sub-build 3 (admin override UI).
Started: 2026-06-03 (action log v70+)
Owner: Adam
Related: assessment.md, removals.md, docs/open-access-pivot/* (A2 schema drops)

---

## What this workstream does

Automates the partner invoice for the 5D New Member subsidy. A 5D New Member
gets a 6-month free period (the Stripe-native trial). 5D (the partner) pays
Valoxi the whole free period UPFRONT at the member's signup: one charge of
$73.95 x free_months per member ($443.70 for campaign 11). The member then
converts to paying monthly themselves once the Stripe trial ends. The report
gathers new members per month and renders the upfront amount; sub-build 2 emails
the partner on a schedule with an audit trail and idempotency.

## Billing model correction (2026-06-03)

The original handover and the first cut of these docs described MONTHLY
collection ("$73.95 per member per month", a per-month cron). That was wrong on
cadence. Adam confirmed the actual commercial model:

- 5D is billed UPFRONT at signup: one charge of $73.95 x free_months
  ($443.70 for campaign 11's 6 months).
- The member converts to their own monthly billing after the trial ends.
- Mid-trial cancellation is NON-REFUNDABLE. The upfront charge is final. No
  proration.

The unit rate ($73.95/member/month) is unchanged; only the collection cadence
changed. The 1b rebuild was redone on the upfront model. The cancel-cap
proration from the monthly cut was removed.

## Scope correction (2026-06-03)

The handover framed 1b as "the invoice page mostly works, just send it." The
assess disproved that on two counts:

- The invoice query sat on the DEAD pre-pivot model
  (`subscriptions.referral_source = '5d_community' AND free_months_total > 0 AND
  free_months_started_at NOT NULL`). No live Stripe-first signup writes those
  fields. It returned 2 legacy prod rows and zero real members.
- The rate was wrong and divergent (server $50.25, client display $73.95).

So a rebuild slice (1b) had to land before any cron. It is now done.

## The sub-build sequence

| # | Slice | Status |
|---|---|---|
| 1 | ASSESS attribution + invoice state (read-only) | COMPLETE 2026-06-03 |
| 1b | REBUILD invoice query onto live model (upfront) + consolidate rate | COMPLETE, proven on dev 2026-06-03 |
| 2 | Auto-send cron, 7th of month 04:00 UK, USD, once-per-member, idempotent | next |
| 3 | Admin override (mark invoiced / resend / view history) UI | after 2 |

## Invoice selection model — LOCKED 2026-06-03 (upfront)

Proven on dev against the live signups (user 110 in May, user 112 on 3 June),
both clean Shape B, plus mixed Shape A/B rows in the May cohort all rendering
identically.

- Cohort: users whose `users.assigned_promo_campaign_id` points at a campaign
  with `promo_code_campaigns.free_months_total > 0`, filtered by the campaign's
  `referral_source` (the `source` param, default `5d_community`). Resolves to
  campaign 11 today; campaign 9 (free_months 0) correctly excluded. Not
  hardcoded to id 11.
- Join: users INNER JOIN promo_code_campaigns INNER JOIN user_companies INNER
  JOIN subscriptions. subscriptions.user_company_id is unique, so one row per
  member.
- Free-period start per member: `COALESCE(subscriptions.trial_start,
  subscriptions.created_at)`. Shape B leaves trial_start NULL, so created_at is
  used (within seconds of signup).
- The member appears on the report for the month their free period STARTED
  (signup month), ONCE.
- Amount: `rate x campaign.free_months_total`, billed UPFRONT. $73.95 x 6 =
  $443.70 for campaign 11.
- No proration. Mid-trial cancellation does not refund. No cancel logic in the
  handler.
- Entitlement (free_months) is read off the CAMPAIGN row, never the
  subscription's zeroed `free_months_total`. This is why one model serves both
  data shapes with no branch.
- Rate: USD always. `MONTHLY_RATE_CENTS = 7395` in the handler. Never derived
  from the member's subscription currency (members can check out GBP or USD;
  5D is always billed USD). Five-site consolidation into
  `config.billing.coreMonthlyDiscountedCents` stays in open-access Phase G.

## Settled facts. Do not re-derive these.

- Billable 5D campaign = id 11, slug `5d`, "5D New Member", `free_months_total = 6`.
  Campaign 9 (`5d-community`, free_months 0) is forever-discount only, NOT billable.
- Coupons: campaign 11 test `cEGIKCtT`, live `dIBdlJg2`, 15% off forever.
- Live Stripe-first 5D row = Shape B: assigned_promo_campaign_id 11,
  free_months_total 0, free_months_started_at/trial_start/trial_end NULL,
  current_period_end ~6 months out, stripe_subscription_id present, trialing,
  CORE, monthly. `free_months_total = 0` on the sub is CORRECT by design.
- 5D billing is UPFRONT: one charge of $73.95 x free_months ($443.70) at signup.
  Member converts to own monthly billing after the trial.
- Mid-trial cancellation: NO refund, charge final, no proration.
- 5D partner billed USD ALWAYS, regardless of the member's GBP/USD checkout
  currency. The partner invoice/charge must be USD-denominated.
- Rate $73.95 = CORE $87 x 0.85 = 7395 cents.
- Do NOT key the window off `current_period_end` (it rolls forward on
  conversion). Window start is COALESCE(trial_start, created_at).

## Risk register

| # | Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|---|
| 1 | Prod pre-cutover test rows appear on a real partner invoice once the query keys on campaign 11 | High | High | Purge prod test rows before go-live. No real users on live yet (Adam confirmed). removals.md. |
| 2 | Member signs up then cancels same month before cron runs | Med | Low | By design billed full upfront, no proration. Not a bug. |
| 3 | Partner invoice billed in member's currency (GBP) instead of USD | Med | High | Settled fact: partner invoice USD-denominated, never from member currency. Enforce in sub-build 2. |
| 4 | Cron double-charges a member | Med | High | Idempotent on a subscription_events audit row keyed once-per-member. Sub-build 2. |
| 5 | A company with two campaign-11 users double-counts the subsidy | Low | Med | Self-serve 5D writes the campaign assignment to one user (the signer). Assumption noted; revisit if multi-user 5D companies appear. |

## Open decisions

| # | Question | Resolved? |
|---|---|---|
| 1 | Partner contact email for the invoice send | OPEN — Dee to confirm. Believed to go to herself today. Decide before sub-build 2. |
| 2 | #99 "referral_source NULL" fold-in | RESOLVED 2026-06-03 — #99 is a symptom of the dead model, not a NULL bug. Rebuild routes around referral_source. Column drops in A2. Treat #99 as closed-by-rebuild. |
| 3 | Mid-trial cancel handling | RESOLVED 2026-06-03 — no refund, charge final. |
| 4 | Member checkout currency vs partner billing | RESOLVED 2026-06-03 — partner always billed USD. |

## Sub-build 2 spec (upfront cron)

- Schedule: 7th of each month, 04:00 UK (buffer if first delivery fails).
- Gathers members whose free period STARTED in the prior month and have not yet
  been invoiced.
- One charge per member, USD, $73.95 x campaign.free_months.
- Audit row in subscription_events, event_type `referral.invoiced`, keyed
  once-per-member (NOT per billing period — it is a one-time charge).
- Idempotent: a re-run finds the per-member audit row and skips. Also gates
  accidental admin re-runs.
- Emails the 5D partner contact (open decision 1).
- Pre-req: prod test-row purge (removals.md) so no test member is invoiced.

## Action log progression

| Version | Slice | Notes |
|---|---|---|
| v70.1 | Sub-build 1 assess + 1b rebuild | Attribution-broken + rate findings; model locked UPFRONT; query rebuilt and proven on dev; #203 closed in same pack |
| next | 2 cron | once-per-member, USD, idempotent |
| later | 3 admin UI | |