# Deal Modeller — Funding Structures Overhaul (#98): Plan

Status: scoped 2026-06-06. Build not started. Higher risk than #202 (schema + calc + migration + UI + doc-gen).
Related: assessment.md, removals.md.

## Slices (one concern each, no chaining, direct ALTER never db:push)

### Slice 1 — Schema
- New table deal_model_seller_payments (payment_type fixed-schedule/instalments/bullet, amount, term_months, frequency, interest_rate nullable default 0, label, sort_order, is_active, scoped via deal_model_id).
- New table deal_model_contingent_consideration (earnout) (consideration_type revenue/ebitda/profit/custom, maximum_amount, term_months, trigger_description, sort_order, is_active).
- New column deal_model_funding_lines.repayment_structure varchar default 'amortizing'.
- Vestigial deal_models columns left in place, marked deprecated in a comment, NOT dropped.
- Explicit constraint names (_unique suffix per #189). Migration assess confirms exact field set against the live seller/earnout rows first.

### Slice 2 — Calc + tests
- Per-line repayment mode in deal-model.calc.ts: amortizing (current PMT), interest-only (interest on balance, no principal), principal-only (principal/term, no interest, rate field hidden).
- Feed seller payments and earnout-at-max into totalAnnualDebtService.
- Invoice-finance interest as an EBITDA deduction (two-sided: keep the line out of isDebt, inject a deduction into calculateAdjustedEbitda).
- Unit tests in shared/calculators/__tests__ covering each mode, seller/earnout in the denominator, the IF-interest two-sided path, and migration-equivalence (amortizing reproduces today's PMT).

### Slice 3 — Migration
- Move the 21 seller + 3 earnout funding-line rows row-for-row into the new tables, single reversible transaction. Preserve amount, term, label (4 of 21 have custom labels), active state. Drop uniformly-empty fields.
- BEFORE/AFTER DSCR check per affected model: confirm seller-neutral, quantify the earnout shift. Report to Adam before declaring done.
- Reversible within the deploy window (recreate funding-line rows from the new tables on rollback).

### Slice 4 — UI
- FundingSection becomes "How do we pay for this" with three blocks: day-one (debt + equity), seller financing (collapsible), earnout (collapsible). Per-line repayment-mode dropdown (3 modes; rate field hides on principal-only). Three reconciling subtotals (day-one / deferred / earnout) = offer price.
- PaymentTermsPanel re-pointed to the new tables (keeps its current reconciliation + earnout maximum/conditional labelling).
- ViabilitySection shows seller and earnout as informational lines alongside the DSCR.

### Slice 5 — Doc-gen + locked-model bug
- Offer letter / heads of terms read seller and earnout from the new tables; earnout figure shown (not hidden). Test generation on a copy of a migrated model.
- Fix the server locked-model read-overwrite bug (reads overwriting computed fields on locked models). Locate at this slice's assess.

## Deferred, design left open
- PIK and bullet repayment modes (pending Dee; bullet interest in DSCR + principal at term-end; PIK out of DSCR + equity-erosion flag).
- Full revolving facility mechanic (drawdowns, utilisation, cash sweeps). Approximated as interest-only on an entered average drawn balance for now.
- Probability-weighted earnout (store maximum only for now).
- AI deal-structure prompt update to write to the new tables (Adam's separate assess after tables land).
- Cash-pay/PIK hybrid split toggle (model as two lines for now).

## Open decisions
| # | Question | State |
|---|---|---|
| 1 | Earnout in offer-price headline and DSCR at maximum | RESOLVED 2026-06-06 (Adam): yes, at max, shown, assessed as payable; non-payment is upside. |
| 2 | PIK / bullet in scope | Deferred, pending Dee. Build 3 modes, leave design open. |
| 3 | Instalments payment type under seller vs earnout | Keep under seller, flag at build (Jag noted it may suit earnout). |
| 4 | Migration ratio-neutrality | RESOLVED 2026-06-06 (Adam): per-row include_in_dscr flag, default true for new rows, migrate existing is_debt verbatim. Zero saved-number shift. New tables carry include_in_dscr. |

## Sequencing
Schema, then calc+tests, then migration, then UI, then doc-gen+bug. Each: assess, apply, V-check, authorise. No commits until functionally confirmed on dev. Migration not run until calc+tests pass.

## Build progress (dev, 2026-06-07)

Calculator, schema, migration and backend CRUD COMPLETE and proven on dev. UI part-built. Not deployed.

- Slice 1 (schema): two new tables + repayment_structure + interest_as_ebitda_adjustment columns. Direct ALTER via scripts/098-create-funding-schema.ts. Done.
- Slice 2a: three repayment modes (amortizing/interest_only/principal_only) on funding lines. Done.
- Slice 2b: seller + earnout-at-max into the DSCR denominator via includeInDscr. Done.
- Slice 2c: invoice-finance interest as an EBITDA deduction (DSCR numerator only; offer price/valuation keep full EBITDA), gated by interest_as_ebitda_adjustment. Done.
- Slice 2d: seller + earnout reproduce the full funding-line footprint (totalFunded, fundingGap, loan-fee base) for zero-shift migration. Done. Calc suite 50/50.
- Slice 3a: repo getByIdWithDetails + buildCalcInputs read and pass the two new tables. Done.
- Slice 3b: pure migration mappers + branch tests (8/8) + repo bulk-insert helpers. Done.
- Slice 3c: atomic migration. 11 seller rows (0 earnout) moved into deal_model_seller_payments on dev, is_debt -> include_in_dscr verbatim; funding mapper now excludes seller_financing/earnout. Parity proven both-ways on all 11 models; --verify clean on 10, model 11 flagged a PRE-EXISTING stale persisted price (minus_corp_tax_due NULL, unrelated to migration). Old funding-line rows left DORMANT for later cleanup.
- Slice 4a: single-row CRUD (repo + service + routes) for both new tables, mirroring funding-line CRUD (lock guard + ownership + recalculate). Routes under canCreateOffers. Done.
- Slice 4b-i: removed seller_financing/earnout from the funding add dropdown. Done.
- Slice 4b-ii: fixed per-line calc-result mis-attribution (calcResults zipped positionally against the now-shorter server calc array; added DEFERRED_FUNDING_TYPES, render + zip both use dayOneLines). Code done; FUNCTIONAL EYEBALL on model 11 (4 day-one cards, correct per-line monthlies) still OWED by Adam.

### Remaining on #98
- 4b-iii: seller block (collapsible, add/edit/delete vs /seller-payments).
- 4b-iv: earnout block (collapsible, vs /contingent-consideration, earnout-at-max framing).
- 4b-v: three reconciling subtotals (day-one / deferred / earnout) = offer price.
- 4c: PaymentTermsPanel re-pointed to the new tables.
- Slice 5: doc-gen re-point (offer letter / heads of terms read seller/earnout from new tables, earnout shown) + locked-model read-overwrite bug.
- Fee-base fix (separate, end of session intent): exclude seller + earnout from totalLoanAmount (loan-arrangement-fee base). Will lower the loan fee on deals with a % loan fee + seller/earnout. Deliberate, surfaced.
- Coordinated prod cutover: run scripts/098-create-funding-schema.ts on prod, run scripts/098-migrate-seller-earnout.ts --commit on prod, deploy code, then --verify on prod (expect possible pre-existing stale-snapshot flags to triage, not block).

### Backlog spun off
- Model 11 (and possibly others) persisted total_purchase_price stale vs current inputs; deal models do not auto-recompute on input edits. Investigate separately.
- payment_type (fixed_schedule/instalments/bullet) is descriptive only today; wiring it to servicing is owed when bullet lands (with PIK, pending Dee).
- Dormant deal_model_funding_lines seller/earnout rows: delete in a cleanup slice once prod is stable.

### Dev state to resume from
Migrated seller data lives in the new tables and feeds the calc; the funding mapper excludes the old types; backend CRUD is complete; the day-one funding list is filtered and correctly aligned. There is no seller/earnout editing UI yet, so seller/earnout currently have no front-end surface (the dropdown no longer offers them and the dormant rows are hidden). TSC baseline: 1 (portal.service.ts:81).

## Session note (2026-06-07, end)

Stopped after 4b-iii-a + client type fix. Resume at 4b-iii-b.

Done since the last progress block:
- 4b-i: seller_financing/earnout removed from the funding add dropdown.
- 4b-ii: per-line calc-result mis-attribution fixed (DEFERRED_FUNDING_TYPES, dayOneLines used for render + calc-zip). Proven aligned on model 23 (script). Live-screen eyeball with seller data still owed.
- 4b-iii-a: sellerPayments threaded through DealModeller -> FundingSection; read-only "Seller Financing (Deferred)" block renders when sellerPayments.length > 0. Screenshot confirmed 4b-i/4b-ii live on a no-seller deal; block-with-data not yet eyeballed.
- Client DealModelWithDetails (local interface in DealModeller.tsx lines 60-64) now declares sellerPayments + contingentConsideration; the as-any cast on the sellerPayments prop removed. Other pre-existing as-any casts (transactionType, minusCorpTaxDue, workingCapital*) left as-is - separate typing tidy-up later.

Resume = 4b-iii-b (NEXT, assess already done):
- Build a lean SellerPaymentCard (NOT a clone of the 330-line FundingLineCard). Fields: label, amount, term_months, interest_rate, include_in_dscr toggle, is_active toggle, delete. NO asset-base/LTV, NO debt/equity classification. Reuse FundingLineCard's debounced-save + focus/blur pattern (debounceRef/pendingRef/isEditingRef, 600ms).
- Add an "Add Seller Payment" button to the seller block header + an add dialog. Parallel add-state names must NOT collide with: addOpen, newType, newLabel, newAmount, newIsDebt, newInterestRate, newTermMonths, resetAddDialog, addMutation. Use seller-prefixed names.
- Endpoints (from 4a, confirmed): POST /:id/seller-payments, PUT /:id/seller-payments/:paymentId, DELETE /:id/seller-payments/:paymentId. apiRequest + onDataChange invalidates ['/api/v2/deal-models', selectedModelId].
- payment_type deliberately NOT surfaced (descriptive only until bullet/PIK land; new rows default fixed_schedule server-side).
- Helper shapes captured: calcLineLocally / LocalLineValues / initLineLocal are funding-line-shaped (asset/ltv/debt); the seller card needs its own trimmed local-state, do not reuse initLineLocal directly.

Then: 4b-iv earnout block, 4b-v three reconciling subtotals, 4c PaymentTermsPanel re-point (also fixes the stale "add a Seller Financing funding line in Section 4" hint, that control is gone), slice 5 doc-gen + locked-model bug, fee-base fix (exclude seller/earnout from totalLoanAmount), coordinated prod cutover.

Eyeballs owed: seller block with real data (model 11/23); 4b-ii alignment on a live screen.
Action log: hold the whole #98 entry until the build lands, then log as v72.x or v73 (Adam to set).
