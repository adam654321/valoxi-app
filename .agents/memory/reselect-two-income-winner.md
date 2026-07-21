---
name: Reselect income reconcile scope (adaptive)
description: When two income winners coexist for the same fiscal year (full-year + part-year slots), the reconcile must not let them evict each other. The reselect service uses a per-year income-winner count to choose wide vs narrow scope.
---

## The rule

`selectProjectionWinners` groups income contributions by `(fiscalYear, statementType, isFullYear)`. When both a full-year (`|1`) and a part-year (`|0`) income contribution exist for the same FY, two separate winners are produced. The old "wide-scope" reconcile (all FY periods, no isFullYear filter) would let each winner evict the other's income_statement, with whichever processed last "winning" — a non-deterministic race.

**Fix applied** (projection-reselect.service.ts step 3 + step 5):
- Before the winners loop, build `incomeWinnersPerYear: Map<FY, count>`.
- If count = 1 for a FY → **wide scope** (all FY periods): needed to evict stale IS left over from a previous reselect run where the sole winner's `isFullYear` changed slot.
- If count > 1 for a FY → **narrow scope** (same `isFullYear` slot only): both ISes coexist legitimately; `fetchReportedEbitdaByYear` gates on `IS.isFullYear=true` so only the full-year IS feeds valuation.

**Why this is correct:**
- Sc-8 (full-year + part-year statutory for same FY): both ISes survive, EBITDA=53k (full-year only), 2 contributions in truth table. ORDER-INDEPENDENT.
- Sc-9 (management + statutory, both full-year): same group key → `selectProjectionWinners` resolves by tier. One winner, one IS. Already order-independent.
- Sc-10 (balance-only company accounts + YTD income): one income winner (part-year) → wide scope → evicts stale full-year IS if any. Still correct.
- Sc-11 (empty + data balance): empty produces no contribution → trivially one balance winner. Already order-independent.

**How to apply:** Do NOT work around the race by ordering test inputs. If a content-based decision produces the wrong result under either upload order, that is a bug in the selector/reconcile — fix the logic, not the test setup.

**TSC baseline note:** portal.service.ts line 81 has a pre-existing `error TS2353` (token property). Not introduced by this work.
