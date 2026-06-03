# 5D Invoice Automation — Removals / Cleanup

Status: 1b COMPLETE on dev. Checklist for pre-go-live purge and later slices.
Owner: Adam
Related: plan.md, assessment.md, docs/open-access-pivot/removals.md (A2)

This workstream tidies INVOICE-SPECIFIC dead code only. Broader schema residue
stays in open-access A2.

---

## 1b — invoice rebuild + rate consolidation — DONE (dev, 2026-06-03)

- [x] `server/routes/admin.routes.ts` referral-invoice handler: dead-model WHERE
      replaced with the campaign-keyed upfront model (users ->
      promo_code_campaigns where referral_source = source AND free_months_total
      > 0; per-member start = COALESCE(trial_start, created_at); appears in
      signup month; amount = rate x campaign.free_months upfront; no cancel cap).
- [x] Rate: stale `INVOICE_RATE = 50.25` removed; single USD constant
      `MONTHLY_RATE_CENTS = 7395` in the handler; server returns it.
- [x] `computeFreeMonthsElapsed` import removed (now unused).
- [x] `client/src/pages/admin/referral-invoice.tsx`: client `INVOICE_RATE`
      literal removed, renders the server value; dead "Codes Remaining
      Unclaimed" card + `codesRemainingUnclaimed` + unused `Tag` import removed;
      columns/cards relabelled to the upfront model (Signed Up / Free Months /
      Upfront Subsidy).
- [ ] `server/config.ts` `billing.coreMonthlyDiscountedCents: 7395` + five-site
      consolidation (the 4 INVOICE_RATE_CENTS in billing.routes.ts + this
      handler + billing.tsx) — LEFT to open-access Phase G. The handler uses a
      correct USD constant meanwhile. Do not pull live billing-credit code into
      this workstream.
- [ ] Nav label "5D Invoice" vs page "5D Subsidy Report" — optional cosmetic
      reconcile, not required for the invoice to be correct.

## Pre-go-live — prod test-row purge (DESTRUCTIVE, deliberate)

Once the invoice keys on campaign 11, leftover prod test rows would appear as
billable on a real partner invoice. They are pre-cutover test data, not real
users (Adam confirmed no real users on live yet).

- [ ] Re-confirm the full prod test cohort at purge time (campaign-9 and
      campaign-11 assigned users + their subscription rows; known so far: 35,
      36, 37 plus the 2 campaign-assigned users with no sub row). Do NOT work
      from a stale list.
- [ ] Decide purge method (soft vs hard delete) deliberately. Touches users +
      subscriptions + user_companies. TARGET: PROD header, dry-run cohort
      eyeball before any live delete.
- [ ] Clear dev test rows (110, 112, the May Shape A/B test set) before the cron
      is enabled on dev, or test sends will fire.

## NOT in this workstream (pointers — stays in open-access A2)

- [ ] DROP subscriptions.referral_source — A2.
- [ ] DROP subscriptions.free_months_total / free_months_started_at /
      community_free_months_remaining / is_community_member — A2.
- [ ] Remove createTrialSubscription / createFiveDNewMemberTrial (0 callers) — A2.

Do not pull these in. The invoice routes around them by design.

## sub-build 2 (cron) — cleanup items, when built

- [ ] Grep the cron registry to confirm no second scheduler already sends a 5D
      invoice before adding the 7th-of-month job.
- [ ] Enforce USD on the partner charge explicitly; never read member currency.

## sub-build 3 (admin UI) — none yet