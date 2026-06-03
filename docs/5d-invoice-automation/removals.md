# 5D Invoice Automation — Removals / Cleanup

Status: checklist for the 1b rebuild and the pre-go-live purge.
Owner: Adam
Related: plan.md, assessment.md, docs/open-access-pivot/removals.md (A2)

Operational checklist. Items tick off as slices ship. This workstream tidies
INVOICE-SPECIFIC dead code only. Broader schema residue stays in open-access A2.

---

## 1b — invoice rebuild + rate consolidation

### Query (server)

- [ ] `server/routes/admin.routes.ts` referral-invoice handler (~line 365-380):
      replace the dead-model WHERE
      (`referral_source = '5d_community' AND free_months_total > 0 AND
      free_months_started_at IS NOT NULL`) with the locked model:
      cohort = users joined where `assigned_promo_campaign_id` -> campaign
      `free_months_total > 0`; window = COALESCE(trial_start, sub.created_at)
      to start + campaign.free_months_total months; month-overlap test; cancel
      cap at canceled_at. See plan.md "Invoice selection model".

### Rate (consolidate to one constant)

- [ ] `server/config.ts` — add `billing.coreMonthlyDiscountedCents: 7395` (shared
      with open-access Phase G; if Phase G already added it, reuse, do not
      duplicate).
- [ ] `server/routes/admin.routes.ts:382` — delete `INVOICE_RATE = 50.25`; compute
      from `config.billing.coreMonthlyDiscountedCents` (cents -> currency as the
      handler needs).
- [ ] `client/src/pages/admin/referral-invoice.tsx:11` — remove the hardcoded
      `73.95`; render the rate the server returns rather than a client literal.
- [ ] Leave `INVOICE_RATE_CENTS = 7395` in billing.routes.ts UNTOUCHED — separate
      purpose (Stripe early-conversion balance credit).

### Confirm at 1b assess

- [ ] Current page title/nav label — is it still "5D Invoice" or renamed "5D
      Subsidy Report" (handover change 6A5)? Grep before editing.

## Pre-go-live — prod test-row purge (DESTRUCTIVE, deliberate)

Once the invoice keys on `assigned_promo_campaign_id IN (billable campaigns)`, the
leftover prod test rows would surface as billable against a real partner invoice.
They are pre-cutover test data, not real users (Adam confirmed no real users on
live yet).

- [ ] Identify the full prod test cohort: campaign-9 and campaign-11 assigned
      users and their subscription rows (known so far: users 35, 36, 37, plus the
      2 campaign-assigned users with no subscription row). Re-confirm at purge
      time, do not work from this stale list.
- [ ] Decide purge method (soft-delete vs hard delete) deliberately. This touches
      users + subscriptions + user_companies. TARGET: PROD header, dry-run cohort
      eyeball before any live delete, per the prod-touching discipline.
- [ ] Any dev controlled-test rows (e.g. user 112, adam+stripe5dtest@valoxi.ai) are
      dev-only and do not need prod purge — but clear them from dev before the
      cron is enabled there so test sends do not fire.

## NOT in this workstream (pointers only — stays in open-access A2)

- [ ] DROP `subscriptions.referral_source` — A2.
- [ ] DROP `subscriptions.free_months_total`, `free_months_started_at`,
      `community_free_months_remaining`, `is_community_member` — A2.
- [ ] Remove `createTrialSubscription` / `createFiveDNewMemberTrial` (0 callers) —
      A2.

Do NOT pull these into the invoice workstream. The invoice routes around all of
them by design; removing them is open-access cleanup, sequenced there.

## sub-build 2 (cron) — cleanup items, when built

- [ ] Confirm no second scheduler already sends a 5D invoice (grep cron registry)
      before adding the 7th-of-month job, to avoid a duplicate send path.

## sub-build 3 (admin UI) — none yet

- [ ] (populate when scoped)