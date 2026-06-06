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
