---
name: Reselect two-income-winner ordering
description: When a fiscal year has both a full-year and a part-year income winner, the last one processed in the reselect loop clears the other via the income reconcile. Contribution DB insertion order drives Map iteration order, which drives reselect processing order.
---

## The rule

When `selectProjectionWinners` returns two income winners for the same fiscal year (e.g. `2024|income|1` and `2024|income|0`), the income reconcile step runs for each winner and deletes income_statements from ALL other periods in that fiscal year. Whichever winner is processed LAST in the for-loop wins.

**Why:** The income reconcile intentionally spans all is_full_year slots (not just the winner's slot) to handle the split-attribution case (Sc-10). This was designed for the one-income-winner case; with two winners the last one evicts the first.

**How to apply:** In tests (and in practice), the full-year "complete" contribution must be the LAST inserted into financial_contributions so it appears last in the Map and is processed last by reselect. Specifically: process the partial/supplementary doc first, then the complete full-year doc. The full-year winner's reconcile then evicts the part-year income_statement, which is the desired "complete copy wins" behaviour.

The DB insertion order of contributions matches the order of processExtractedData calls (no ORDER BY in reselect's rawContribs query; PostgreSQL returns fresh rows in heap/insertion order for small tables with no concurrent writes).

**TSC baseline note:** portal.service.ts line 81 has a pre-existing `error TS2353` (token property). This existed before the forward-path gate work and is not introduced by it.
