---
name: Reselect income reconcile scope
description: Why income reconcile in step 4 of reselect spans ALL fiscal-year periods while balance reconcile stays in its own is_full_year slot.
---

## The rule

In `projection-reselect.service.ts` step 4, the query that finds "other periods in the same slot" to clear losers uses:
- **Income winners**: no `is_full_year` filter — spans ALL periods of that fiscal year
- **Balance winners**: `eq(financialPeriods.isFullYear, winner.isFullYear)` — stays in its own slot

## Why

**Split-attribution case:** A Company Accounts PDF can create a `is_full_year=true` container period and write both IS and BS rows into it. A separate YTD P&L document writes IS figures to the same period. After Slice 18 detects the YTD filename and flips the income contribution's `is_full_year` to `false`, the next reselect creates a NEW `is_full_year=false` period for that income winner. Without widening the income reconcile, the old `is_full_year=true` container keeps its `income_statement` row intact.

**Secondary blocker:** If a full-year BALANCE winner also exists for the same fiscal year, `yearToWinnerPeriodId` gains an entry for that year. `clearOrphanedFigures` then skips the year entirely (it only evicts figures from years with NO full-year winner), so the safety net also fails to clear the stale income. The widened income reconcile fires BEFORE `clearOrphanedFigures` and handles this independently.

## How to apply

Any time the reconcile query in step 4 is modified, ensure income winners do NOT include `eq(financialPeriods.isFullYear, winner.isFullYear)` as a condition. Balance winners must keep that filter so full-year and part-year balance periods are reconciled independently. The pattern is:

```typescript
winner.statementType === 'balance'
  ? eq(financialPeriods.isFullYear, winner.isFullYear)
  : undefined,   // income: clear across all is_full_year slots
```

Drizzle's `and()` silently drops `undefined` conditions — this is intentional and already used elsewhere in this service.
