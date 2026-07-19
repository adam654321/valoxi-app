---
name: Stable year-container model
description: Slice 16 final — rules for keeping financial_period container ids stable across reselects, including survivor priority, adjustment/staff re-pointing, figure clearing, and prune conditions.
---

## Survivor priority in `findOrReusePeriod`
When multiple periods exist for the same (company, fiscalYear, isFullYear) slot, pick survivor in this order (all within periods ordered by id ASC):
1. Lowest-id period that has an `ebitda_adjustment` (FK must never move)
2. Lowest-id period that has income or balance data
3. Lowest-id period (existing[0])

**Why:** ebitda_adjustments are user-entered on a specific year and must never silently vanish. Keeping the adjustment-holding period as the survivor ensures the FK never needs to change.

## After the winner loop

1. **`repointAdjustments`** — for each year in `yearToWinnerPeriodId`, UPDATE `ebitda_adjustments` from non-survivor periods to the survivor. Adjustments are year-bound; they follow the winner of that year.

2. **`repointStaffData`** — UPDATE all `staff_data` for the company to point to `latestWinnerPeriodId` (highest fiscalYear winner). staff_data is a company-current singleton tracking the most recent trading year.

3. **`clearOrphanedFigures`** — DELETE income/balance from full-year periods whose fiscalYear is NOT in `winnerFiscalYears`. Happens when all contributions for a year are removed and no fallback exists. Must run BEFORE prune.

4. **`pruneGhostPeriods`** — prune full-year periods NOT in winner set where ALL of these are absent: income, balance, staff_data, ebitda_adjustments. A container with only an adjustment (no figures) is KEPT.

## upsertIncome/Balance sourceDocumentId
Must come from `winner.sourceDocumentId`, NOT from `figures.sourceDocumentId` (the figures JSON never contains it). Pass as a dedicated `winnerSourceDocumentId` parameter.

**Why:** After `detachDocumentReferences` sets income.source_document_id = null, the subsequent upsert must restore it from the winner's source. Pulling from figures JSON silently left it null.

## document-delete-fk test update (Slice 16 final)
Old behaviour: FY2022 period survived after its only doc was deleted (detached with null source).
New behaviour: FY2022 is pruned (clearOrphanedFigures removes income, pruneGhostPeriods removes the now-empty container). Test updated accordingly.

## Company 105 baseline (post Slice 16 run)
5 full-year periods: 463(FY2022,inc+bal), 464(FY2023,inc+bal), 465(FY2024,inc+bal), 466(FY2021,inc+bal), 474(FY2025,inc only). All data-bearing, no adjustments on any.
