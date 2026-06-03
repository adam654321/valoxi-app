# 5D Invoice Automation — Assessment

Status: sub-build 1 assess COMPLETE 2026-06-03. Model locked UPFRONT same day.
1b rebuild proven on dev 2026-06-03.
Owner: Adam
Related: plan.md, removals.md

---

## Why this workstream exists

The 5D New Member subsidy generates a partner invoice. The existing
`/admin/referral-invoice` surface ("5D Invoice" in the admin nav, page titled
"5D Subsidy Report") was built against the pre-pivot data model and had never
run against a live Stripe-first signup. The assess answered: is attribution
working, who is visible, who should be, what does it calculate.

## Finding 1 — attribution is broken end to end

The live signup path and the invoice read different fields, and nothing bridges
them.

- The Stripe-first webhook (C-new.2) writes `users.assigned_promo_campaign_id`
  via `assignCampaignToUser`. It never writes `subscriptions.referral_source`.
  A grep confirmed the only writer of `referral_source` is the admin
  campaign-CRUD route, and that writes `promo_code_campaigns.referral_source`,
  not the subscriptions column.
- The invoice selected on `subscriptions.referral_source = '5d_community'` — a
  column no live path populates. It saw 2 legacy prod rows and zero real members.

Root of open item #99. #99 is NOT a NULL-population bug; it is a symptom of the
invoice sitting on the wrong model. Campaigns 9 and 11 also share the
`referral_source` string `'5d_community'`, so even if populated it could not
distinguish billable (11) from non-billable (9). The discriminant is
`assigned_promo_campaign_id` -> campaign `free_months_total`.

## Finding 2 — billable campaign is 11, not 9

| id | name | slug | free_months_total | coupon (prod) | billable? |
|---|---|---|---|---|---|
| 9 | Standard 5D community | 5d-community | 0 | t7DDiD9J | NO (discount only) |
| 11 | 5D New Member | 5d | 6 | dIBdlJg2 | YES (6-month subsidy) |

Only campaign 11 carries a subsidised free period.

## Finding 3 — two data shapes, one model

- Shape A (pre-cutover / admin-assigned): `free_months_total > 0`,
  `free_months_started_at` populated. Old DB-trial mechanism, retired 20 May.
  All prod rows 35/36/37 are Shape A, dated 24 April. Fingerprint:
  `community_discount_coupon_id = 'upgraded_early'`.
- Shape B (live Stripe-first): `free_months_total = 0`, `free_months_started_at`
  NULL, `trial_start`/`trial_end` NULL, only `current_period_end` (~6 months
  out) and `stripe_subscription_id` populated, trialing. Canonical going forward.
  Confirmed on user 110 (20 May) and the controlled test signup user 112
  (3 June, adam+stripe5dtest@valoxi.ai, "Cheese R Us").

The rebuilt invoice reads entitlement off the CAMPAIGN row, so one model serves
both shapes with no branch. Proven on dev: the May report rendered Shape A and
Shape B members identically at $443.70.

## Finding 4 — rate was wrong and divergent

Server computed $50.25 (admin.routes.ts), client displayed $73.95
(referral-invoice.tsx). Correct is $73.95 = $87 x 0.85. No money had moved only
because the query returned the wrong cohort. Consolidated server-side to one
USD constant at 1b; client now renders the server value.

## Finding 5 — billing cadence is UPFRONT, not monthly (corrected 2026-06-03)

The handover and the first cut of these docs said "per member per month" with a
monthly cron. Adam corrected this: 5D is billed UPFRONT at signup — one charge
of $73.95 x free_months ($443.70 for campaign 11) — and the member converts to
their own monthly billing after the Stripe trial. Mid-trial cancellation is
non-refundable. The unit rate is unchanged; the collection cadence is upfront.
The 1b rebuild was redone on this model (signup-month selection, amount x
free_months, no cancel-cap proration).

## 1b rebuild outcome (proven on dev 2026-06-03)

- Query repointed to users -> promo_code_campaigns (referral_source + free_months
  > 0) -> user_companies -> subscriptions.
- Per member: start = COALESCE(trial_start, created_at); appears in signup
  month; amount = $73.95 x campaign.free_months billed upfront.
- Rate consolidated server-side (USD), client renders server value; dead "Codes
  Remaining Unclaimed" card removed (Phase B residue, server never returned it).
- Functional proof: June report showed user 112 only, 6 months, $443.70. May
  report showed 5 members, all $443.70, total $2218.50. User 37 (campaign 9)
  absent in all months. TSC baseline held (1, portal.service.ts:81).

## State at assess time

Prod: 5 users on 5D campaigns (2 on 9, 3 on 11), only 3 with a subscription row,
all pre-cutover (24 April), none real users. 2 rows with non-null
subscriptions.referral_source — legacy, the only rows the old query returned.

Dev: multiple campaign-11 rows across both shapes; the clean Shape B rows
(110, 112) are the canonical reference.

## Surfaces

- Route: `GET /api/v2/admin/referral-invoice`, handler admin.routes.ts.
- Client: client/src/pages/admin/referral-invoice.tsx.
- Nav: admin-layout.tsx ("5D Invoice"). Page <h1>: "5D Subsidy Report". Rename
  6A5 partially applied (page title changed, nav link not). Cosmetic, not in 1b.

## Lesson captured

LN — establish collection CADENCE at the assess, do not inherit it from doc
phrasing. The monthly-vs-upfront distinction was never an explicit question; the
docs said "per month" and the first 1b cut implemented monthly with a cancel cap.
Adam's correction forced a redo. The assess for a billing feature must pin down
unit rate, cadence (upfront vs recurring), and refund/proration before drafting.

## Process note

The marketing site `.env.local` had `NEXT_PUBLIC_VALOXI_API_BASE` pointed at
PROD. A local test signup would have provisioned into prod. Repointed to dev for
the controlled test. NEXT_PUBLIC_ vars inline at dev-server START — set then
restart before any local checkout test.

## Deferred / out of scope

| Item | Reason |
|---|---|
| Drop referral_source, free_months_total, free_months_started_at | Open-access A2. |
| Remove createTrialSubscription / createFiveDNewMemberTrial | Open-access A2 (0 callers). |
| Five-site rate consolidation into config.billing.coreMonthlyDiscountedCents | Open-access Phase G. 1b uses a correct USD constant in the handler. |
| Nav label "5D Invoice" vs page "5D Subsidy Report" | Cosmetic, optional cleanup. |
| Partner contact email | Open decision, Dee to confirm, before sub-build 2. |