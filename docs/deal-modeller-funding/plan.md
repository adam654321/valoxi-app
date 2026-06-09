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
- ~~4b-iii: seller block (collapsible, add/edit/delete vs /seller-payments).~~ DONE
- ~~4b-iv: earnout block (collapsible, vs /contingent-consideration, earnout-at-max framing).~~ DONE
- ~~4b-v: three reconciling subtotals (day-one / deferred / earnout) = offer price.~~ DONE
- ~~4c: PaymentTermsPanel re-pointed to the new tables.~~ DONE (all three sub-slices)
- ~~Slice 5: doc-gen re-point (offer letter / heads of terms read seller/earnout from new tables, earnout shown) + locked-model read-overwrite bug.~~ DONE
- ~~Fee-base fix: exclude seller + earnout from totalLoanAmount (loan-arrangement-fee base).~~ DONE
- **Coordinated prod cutover** (NEXT): run scripts/098-create-funding-schema.ts on prod, run scripts/098-migrate-seller-earnout.ts --commit on prod, autoscale deploy of #98 + #202 + R2 removal, then --verify on prod (expect possible pre-existing stale-snapshot flags to triage, not block), then acceptance checks.

### Backlog spun off
- Model 11 (and possibly others) persisted total_purchase_price stale vs current inputs; deal models do not auto-recompute on input edits. Investigate separately.
- payment_type (fixed_schedule/instalments/bullet) is descriptive only today; wiring it to servicing is owed when bullet lands (with PIK, pending Dee).
- Dormant deal_model_funding_lines seller/earnout rows: delete in a cleanup slice once prod is stable.
- Deal model lock: endpoint and service wired but no UI calls them; Send Offer does not lock; lock takes no snapshot. Lock-intent review (snap on lock, surface a "Lock" button) added to backlog.
- Fee structure redesign (new workstream, post-#98 cutover): flexible fee lines, multiple loan fees, remove dead broker column. Scoping kickoff = edited-vs-untouched prod fee assess.

### Dev state (feature-complete, awaiting cutover)
All dev build work done. No locked prod models today (lock is dead client-side). TSC baseline: 1 (portal.service.ts:81). 69 calc tests passing.

## Session note (2026-06-07, end)

Stopped after 4b-iii-a + client type fix. Resume at 4b-iii-b.

Done since the last progress block:
- 4b-i: seller_financing/earnout removed from the funding add dropdown.
- 4b-ii: per-line calc-result mis-attribution fixed (DEFERRED_FUNDING_TYPES, dayOneLines used for render + calc-zip). Proven aligned on model 23 (script). Live-screen eyeball with seller data still owed.
- 4b-iii-a: sellerPayments threaded through DealModeller -> FundingSection; read-only "Seller Financing (Deferred)" block renders when sellerPayments.length > 0. Screenshot confirmed 4b-i/4b-ii live on a no-seller deal; block-with-data not yet eyeballed.
- Client DealModelWithDetails (local interface in DealModeller.tsx lines 60-64) now declares sellerPayments + contingentConsideration; the as-any cast on the sellerPayments prop removed. Other pre-existing as-any casts (transactionType, minusCorpTaxDue, workingCapital*) left as-is - separate typing tidy-up later.

## Session note addendum (2026-06-07, end of session 2)

4b-iii COMPLETE on dev: seller financing is addable, editable, deletable, and moves the DSCR by its true annual service.
- 4b-iii-a: read-only seller block + client type fix (DealModelWithDetails now declares sellerPayments + contingentConsideration; as-any cast on the prop removed).
- 4b-iii-b: interactive SellerPaymentCard (label/amount/term/interest/include_in_dscr/active/delete, debounced save) + Add Seller Payment dialog, against /seller-payments endpoints. payment_type not surfaced (deferred to bullet/PIK).
- 4b-iii-c: BUG FIXED - the client-side calculations call in DealModeller.tsx line 279 was four-arg, so the live on-screen DSCR ignored seller/earnout. Now passes modelDetails.sellerPayments + contingentConsideration. Verified live: adding a £250k/60mo/0% seller payment to model 51 (company 23) raised annual debt service by £50k and moved the DSCR. Also removed the "Also known as Payment Cover Ratio" subtitle from ViabilitySection.
- Client double-count check: the client fundingLines mapper (DealModeller.tsx line 242) does NOT filter seller_financing/earnout, but dormant funding-line rows are isActive=false (skipped by calculateFundingStack) and hidden from the day-one UI by 4b-ii, so there is no live double-count. The client-mapper filter is belt-and-braces, folded into the dormant-row deletion cleanup slice (deleting the rows makes it moot).

## Session note (2026-06-09, action log v72.2) — #98 FEATURE-COMPLETE

#98 is feature-complete on dev and ready for coordinated prod cutover.

Done this session:
- 4b-iv: earnout block (collapsible, ContingentConsiderationCard against /contingent-consideration, earnout-at-max framing, maximumAmount field). COMPLETE.
- 4c-i: Section 5 re-pointed to the new seller/earnout tables; day-one breakdown added (your consideration vs total to seller, cash handled by subtraction not a separate line).
- 4c-ii: Offer letter and HoT re-pointed to the new tables; earnout shown.
- 4c-iii: Dropped seller-facing "(maximum)" qualifier from the earnout figure.
- Add Source: asset-base/LTV surfaced on the add funding dialog.
- Receivables term-lock: term field locked in Add dialog, edit card, and seed data normalised.
- Locked-model read-overwrite fix: `getModel` now routes locked models through `computeFor` (no DB write) instead of `recalculate`. Read-only hardening — no locked prod models today so no active risk.
- Fee-base fix: removed `sellerActiveTotal + earnoutActiveTotal` from `totalLoanAmount`. Loan-arrangement-fee base is now genuine lending only. Prod impact assessed read-only: 26 of 63 prod models affected (all draft/unlocked), £152,212.98 total loan-fee overstatement corrected on deploy. Fee amounts are never persisted so no DB backfill needed. Calc suite updated: 4 old migration-parity tests replaced with 7 correct exclusion tests; 69/69 passing.

Findings settled:
- Section 5 and the offer letter were reading seller/earnout off the dormant seller_financing/earnout funding-line rows from the 3c migration, showing the full offer price as day-one with no deferred/earnout. Re-pointed to the new tables fixes this.
- Offer price is cash-inclusive by design (valuation bridge adds excess cash); Section 4 handles cash by subtraction. Section 5 shows day-one funded by you plus business cash, with two totals: your consideration (cash excluded) and total to seller (cash included = offer price). No separate cash line that double-counts.
- Deal model lock is dead client-side: endpoint and service wired but no UI calls them; Send Offer does not lock; lock takes no snapshot. Read-overwrite fix is correct hardening. Lock-intent review deferred to backlog.
- Fee-base fix is correct under any future fee model and changes only the indicative loan fee on draft, unlocked deals.

Deferred to new workstream after #98: fee structure redesign (flexible fee lines, multiple loan fees, remove dead broker column), with an edited-vs-untouched prod fee assess as its scoping kickoff.
