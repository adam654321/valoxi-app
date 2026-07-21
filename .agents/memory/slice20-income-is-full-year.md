---
name: Slice 20 income is_full_year gate
description: income_statements.is_full_year column stamped by reselect; fetchReportedEbitdaByYear gates on it instead of financial_periods.is_full_year.
---

## Rule
`fetchReportedEbitdaByYear` (and `getDevEbitdaByYear` in comms-analysis.ts) must gate on `income_statements.is_full_year = true`, NOT `financial_periods.is_full_year = true`.

## Why
The period container's `is_full_year` flag is stamped by the **balance sheet** winner's span via `findOrReusePeriod`. If the income winner for the same year is a YTD/part-year P&L, the period can still be `is_full_year=true` (set by a full-year balance sheet), causing part-year EBITDA to leak into valuation.

## How to apply
- `income_statements` has a boolean column `is_full_year NOT NULL DEFAULT true` (added via direct ALTER TABLE, not db:push — pre-existing schema drift prevents db:push without accepting unrelated data-loss ops).
- `upsertIncomeFromFigures(periodId, tcId, figures, winnerSourceDocId, isFullYear)` stamps the column from `winner.isFullYear` in `reselect()`.
- `winner.isFullYear` comes from `financial_contributions.is_full_year`, which is set by the backfill + Slice 18 patch (computeSpan + YTD doc-name hint).
- Any new query that needs "full-year income only" should join `income_statements` and filter `eq(incomeStatements.isFullYear, true)`.
- Balance sheet path is unchanged — balance winner still stamps `financial_periods.is_full_year`.

## Schema migration note
Use a direct `ALTER TABLE income_statements ADD COLUMN IF NOT EXISTS is_full_year boolean NOT NULL DEFAULT true` (see `scripts/migrate-income-is-full-year.ts`). Do NOT use `db:push` — it will prompt to accept pre-existing data-loss diffs (session table, column type changes, etc.) unrelated to this change.

## stable-year-container.test.ts pre-existing failures
The 6 tests in that file fail because they use far-future fiscal years (FY3923–3926) that are blocked by the Slice 17 `fiscalYear <= currentYear` gate. Pre-dates Slice 20; unrelated.
