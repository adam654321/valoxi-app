# 5D Invoice Automation — Assessment

Status: sub-build 1 assess COMPLETE 2026-06-03. Model locked the same day.
Owner: Adam
Related: plan.md, removals.md

---

## Why this workstream exists

The 5D New Member subsidy generates a monthly partner invoice ($73.95 per member
per month during the 6-month free period). The existing `/admin/referral-invoice`
surface ("5D Invoice" in the admin nav) was built against the pre-pivot data
model and has never run against a live Stripe-first signup. The assess set out to
answer: is attribution working, who is visible to the invoice, who should be, and
what does it calculate.

## Finding 1 — attribution is broken end to end

The live signup path and the invoice read different fields, and nothing bridges
them.

- The Stripe-first webhook (C-new.2, billing.routes.ts checkout.session.completed)
  writes `users.assigned_promo_campaign_id` via `assignCampaignToUser`
  (promo-code.service.ts:71-85) when a `promoSlug` is present in session metadata.
- It NEVER writes `subscriptions.referral_source`. A grep of server/ and shared/
  found the only writer of `referral_source` is the admin campaign-CRUD route
  (admin.routes.ts:323), and that writes `promo_code_campaigns.referral_source`,
  not the subscriptions column. Every other reference is a read.
- The invoice (admin.routes.ts:365-380) selects on
  `subscriptions.referral_source = '5d_community'`. That column is never populated
  by any live path, so the invoice sees only 2 legacy prod rows and zero real
  members.

This is the root of open item #99. #99 is NOT a NULL-population bug to be patched
by writing referral_source; it is a symptom of the invoice sitting on the wrong
model. Also: campaigns 9 and 11 SHARE the `referral_source` string `'5d_community'`,
so even if populated it could not distinguish billable (11) from non-billable (9).
The discriminant must be `assigned_promo_campaign_id` -> campaign `free_months_total`.

## Finding 2 — billable campaign is 11, not 9

The handover named campaign 9. Prod campaign rows corrected this:

| id | name | slug | free_months_total | coupon (prod) | billable? |
|---|---|---|---|---|---|
| 9 | Standard 5D community | 5d-community | 0 | t7DDiD9J | NO (discount only) |
| 11 | 5D New Member | 5d | 6 | dIBdlJg2 | YES (6-month subsidy) |
| 10 | Early Bird | early-bird | 0 | BOWWbbs6 | n/a (inactive) |
| 12 | Welcome Discount | welcome | 0 | WELCOME20 | n/a (discount only) |

Only campaign 11 carries a subsidised free period and is therefore billable.

## Finding 3 — two data shapes, and which is canonical

Campaign-11 subscription rows in dev show two distinct write patterns:

- Shape A (pre-cutover / admin-assigned, pre C-new.2): `free_months_total > 0`,
  `free_months_started_at` populated, `trial_start`/`trial_end` populated on some.
  This is the OLD DB-trial mechanism (`createFiveDNewMemberTrial`), retired at the
  20 May cutover. All prod rows 35/36/37 are Shape A, dated 24 April, pre-launch.
  `community_discount_coupon_id = 'upgraded_early'` is the Shape A fingerprint.
- Shape B (live Stripe-first, C-new.2): `free_months_total = 0`,
  `free_months_started_at` NULL, `trial_start` NULL, `trial_end` NULL, only
  `current_period_end` (~6 months out) and `stripe_subscription_id` populated,
  `status = trialing`.

Shape B is canonical going forward. Confirmed identical on two independent live
signups:

- user 110, sub 92, created 2026-05-20, `current_period_end` 2026-11-20.
- user 112, sub 94, created 2026-06-03 (controlled test signup, email
  adam+stripe5dtest@valoxi.ai, company "cheese r us"), `current_period_end`
  2026-12-03, every field clean Shape B.

The invoice reads entitlement off the CAMPAIGN row (`free_months_total`), not the
subscription row, so one model serves both shapes with no branch and no backfill.
Shape A rows are test data, to be purged, not migrated.

## Finding 4 — rate is wrong and divergent

Three literals, two purposes, one mismatch:

| Literal | File | Line | Value | Purpose |
|---|---|---|---|---|
| INVOICE_RATE | admin.routes.ts | 382 | 50.25 | server invoice total — STALE/WRONG |
| INVOICE_RATE | referral-invoice.tsx | 11 | 73.95 | client display — correct value, but server disagrees |
| INVOICE_RATE_CENTS | billing.routes.ts | 700/784/982/1148 | 7395 | Stripe balance-credit on early conversion — SEPARATE purpose, leave |

Correct invoice rate is $73.95 ($87 x 0.85). The server's $50.25 would have
undercharged the partner by $23.70/member/month had the invoice ever returned the
right cohort. It hasn't, so no money has moved. Consolidate the two INVOICE_RATE
literals into one config constant at 1b.

## State at assess time

Prod (read-only inspection):
- 5 users assigned to 5D campaigns (2 on campaign 9, 3 on campaign 11). Only 3
  have a subscription row. All 5 are pre-cutover (24 April), all Shape A or
  partial. None are real users (Adam confirmed no real users on the live code).
- 2 rows have `subscriptions.referral_source` non-null — legacy, not among the
  5D-assigned users. These are the only rows the current invoice query returns.

Dev:
- Multiple campaign-11 rows across both shapes. The two clean Shape B rows (110,
  112) are the canonical reference.

TSC baseline: 1 pre-existing error, portal.service.ts:81. Hold it.

## Surfaces (for the 1b rebuild)

- Route: `GET /api/v2/admin/referral-invoice`, handler admin.routes.ts:352.
- Client page: client/src/pages/admin/referral-invoice.tsx.
- Nav: client/src/components/admin-layout.tsx:34 ("5D Invoice").
- Note possible rename to "5D Subsidy Report" referenced in the handover (change
  6A5) — confirm the current page title/label at the 1b assess.

## Process note caught this session

The marketing site `.env.local` had `NEXT_PUBLIC_VALOXI_API_BASE` pointed at
`https://app.valoxi.ai` (PROD). A local test signup would have provisioned into
prod. Repointed to the dev app for the controlled test. Recorded as a standing
trap: NEXT_PUBLIC_ vars inline at dev-server START, so the var must be set then
the server restarted before any local checkout test. See open-access lessons.

## Deferred / out of scope

| Item | Reason |
|---|---|
| Drop of referral_source, free_months_total, free_months_started_at | Open-access A2, already scheduled. NOT this workstream. |
| Removal of createTrialSubscription / createFiveDNewMemberTrial | Open-access A2 candidates (0 callers). |
| Supabase keys in marketing .env.local | Open-access Phase G hygiene. |
| Partner contact email | Open decision, Dee to confirm, before sub-build 2. |