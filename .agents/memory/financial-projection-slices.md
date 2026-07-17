---
name: Financial projection slices
description: Architecture and completion status of the multi-slice financial projection system (contributions table, selector, reselect wiring).
---

## Status: Slices 1–3 complete

### Slice 1 — financialContributions table
- Table: `financial_contributions` in `shared/schema/financials.ts`
- Backfill script: `server/scripts/backfill-financial-contributions.ts` — exports `resolveSourceTier(periodType, documentCategory)` (pure sync)
- Created on DEV via raw SQL (non-interactive); `db:push` alone is insufficient for this table since it was added separately

### Slice 2 — Pure selector
- Location: `shared/calculators/projection-selector.ts`
- Export: `selectProjectionWinners(contributions: Contribution[]): Contribution[]`
- Tier precedence: user_override=0, statutory=1, management=2, information_memorandum=3 (lower wins)
- Tie-break: newest `createdAt`, then highest `sourceDocumentId`
- 9 unit tests in `shared/calculators/__tests__/projection-selector.test.ts`

### Slice 3 — Reselect wiring (DONE)
- Core: `server/services/projection-reselect.service.ts` — exports `reselect(targetCompanyId)`
- Invariants: contributions never mutated; ebitda_adjustments/staff_data never touched; financial_periods never deleted (IDs preserved for FK safety)
- Normalisation wiring: `financial-data.service.ts` now writes to `financial_contributions` (delete-then-insert by sourceDocumentId for idempotency) and calls `reselect` at end of `processProfitAndLoss` and `processBalanceSheet`
- Delete wiring: both `documents-files.service.ts` and `portal-submissions.service.ts` now call `deleteNonProjectionByDocumentId` (staff/debtors/assets/loans only) + delete contributions + `reselect` instead of the old destructive `deleteByDocumentId` cascade
- `contributionTier()` is a local helper in `financial-data.service.ts` (not imported from backfill script)
- 5 acceptance tests in `server/services/__tests__/projection-reselect.test.ts` (DB integration tests, gracefully skip if no targetCompanyId found)
- 116 tests pass total; TypeScript clean (only pre-existing portal.service.ts:81 error)

**Why:** Separates "what was extracted from each document" (contributions, append-only truth) from "what the projected view shows" (income_statements, balance_sheets). Enables fallback (IM→statutory) and delete-then-recalculate without losing history.
