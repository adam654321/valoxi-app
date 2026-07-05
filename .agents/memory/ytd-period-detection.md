---
name: YTD period detection
description: How Valoxi distinguishes a partial-year (YTD) financial period from a full fiscal year when period metadata doesn't explicitly flag it.
---

Don't assume a company's fiscal year ends in December. Infer the fiscal-year-end month by finding the most frequent `periodEnd` month across all of a company's periods; any period ending in a different month is treated as YTD (year-to-date/interim), not a full year.

**Why:** Company 89 (Innova Design Group) had a May-2026 interim period that was being rendered and averaged as if it were a full fiscal year, because the code assumed Dec 31 = year-end. Real UK companies can have any fiscal-year-end month, and a business's most recent period is often a partial-year interim snapshot rather than a completed year.

**How to apply:** Implemented in `client/src/lib/period-utils.ts` (`detectYtdPeriods`, `getYtdMonths`, `formatYtdLabel`). Any UI or calculation that lists a company's financial periods (P&L tables, EBITDA averaging, multi-year comparisons) should run periods through `detectYtdPeriods` first and exclude/flag YTD periods rather than treating every period as a full year. When annualising a YTD period for display, scale by `12/monthsElapsed` and keep it opt-in/reversible; never fold annualised or YTD figures into multi-year averages meant for full fiscal years.
