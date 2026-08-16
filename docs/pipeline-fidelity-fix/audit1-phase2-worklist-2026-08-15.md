---
# AUDIT-1 Phase 2 worklist — prioritised

Written 15 August 2026. Source: `docs/pipeline-fidelity-fix/audit1-capture-2026-08-15.txt`
(fresh in-memory extraction, 24 documents, PROMPT_VERSION `1c-noanchor`, commit
`755dafa`, no prompt files changed since 8918cfa) and
`docs/pipeline-fidelity-fix/audit1-phase1-comparison-2026-08-15.txt` (cross-document
GROUP A comparison, commit `3e39b60`). This is analysis of the Phase 1 comparison
output, not PDF verdicts. Every "correct" or "explained" claim below rests on
prior HANDOVER findings or period metadata already in the capture, not on a
fresh PDF read. Nothing here is a substitute for Phase 2.

Of 12 (company, fiscal_year) groups with 2+ contributing documents, 80 field-level
disagreements: roughly 19 are now explained without opening a PDF, leaving
genuinely unexplained candidates concentrated in about 8 groups.

## RESOLVED — no PDF check needed

**Company 1881 FY2026** (docs 5879, 5880, 5881). GROUP B period check: 5879
covers 12 months to 2026-02-28. 5881 covers 4 months, 2026-03-01 to
2026-06-25 — starts exactly where 5879 ends, a different (later) period. 5880
has no period_start but its period_end matches 5881, so probably the same
partial period. All 13 disagreement fields in this group are period mismatches,
not extraction conflicts. Recommend excluding YTD/interim documents from
full-year comparison groupings in any future run of this comparison.

**Company 1877 FY2023** (docs 5830, 5831, 5835), 6 of its fields. Retained
earnings, long-term liabilities, corporation tax and net profit all move by the
same £4,434 between 5831 and 5830/5835 — one internally consistent restatement.
This is the Midland case HANDOVER already settled: 132,092 (doc 5830, the later
signed accounts) is correct, 136,526 (doc 5831, the earlier document) is
superseded. No new work.

**Doc 5835, net_profit = profit_before_tax = operating_profit** (appears in both
1877 FY2023 and FY2024 groups). Matches HANDOVER item 436 — the known IM/broker
net-profit-filled-with-operating-profit defect, SELLER_ASSERTED and bounded.
Not new, already tracked.

## PARTIALLY RESOLVED

**Company 1880 FY2025** (docs 5857, 5860, 5865, 5867). Doc 5865 is a 7-month
period to 2025-05-31; the other three are 12 months to 2025-10-31. Its 8 solo
disagreements (revenue 1.4M vs ~4.5M, net profit −169,631 vs positive) are period
mismatches, not defects. Doc 5860 is NOT explained by this: it disagrees with
5857/5867 on administrative_expenses (1,303,834 vs 1,361,040), cost_of_sales
(3,044,637 vs 2,979,013), corporation_tax, gross_profit, net_profit,
operating_profit, profit_before_tax, and revenue (4,508,976 vs 4,509,086, a
small but real gap). Needs a PDF check.

## CANDIDATE DEFECT CLASS — cost_of_sales / administrative_expenses boundary

Company 1881 (Cooper-Gibson), recurring across FY2023, FY2024 and FY2025:
administrative_expenses and cost_of_sales scatter widely across the contributing
documents for the same year, while gross_profit moves by close to the same
amount — consistent with one cost line being split differently between the two
categories in different extractions, not several independent misreads. Example,
FY2023: doc 5873 cost_of_sales=68,452 vs doc 5874=447; the admin_expenses gap
between the two (66,325) is close to 5873's own cost_of_sales figure. Same
signature recurs in FY2024 (four documents, admin_expenses scattered
12,094/204,475/65,375/69,383) and FY2025. Recommend checking one year's PDF
closely for the actual COS/admin split before treating this as three unrelated
defects — it may be one.

## GENUINE CANDIDATES — cheap first

1. **Company 1880 FY2022** — corporation_tax sign only. Doc 5863: 19,642. Docs
   5862/5869: −19,642. One document, one field, likely a sign-convention slip.
2. **Company 1880 FY2024** — doc 5857 alone on interest_payable (19,699 vs
   18,842 for the other three) and interest_receivable (857 vs 0/null). One
   document, two fields.
3. **Company 1880 FY2023** — trade_debtors, a clean 2–2 split: docs 5861/5868
   agree at 470,739; docs 5862/5869 agree at 553,354. Structured, not noise —
   worth checking which pair is right.
4. **Company 1877 FY2022** — depreciation_amortisation (10,960 vs 10,962, doc
   5831 vs 5835), net_profit, profit_before_tax disagree between the same two
   documents.
5. **Company 1877 FY2024** — long_term_liabilities.total (319,401 vs 272,466,
   £46,935 gap, doc 5830 vs 5835). This is separate from the known IM
   net_profit defect already explained above — this field is unexplained.
6. **Company 1877 FY2025** — doc 5836 is the outlier on retained_earnings /
   equity.total (622,863/622,963 vs 279,164 for doc 5832) and net_profit
   (183,127 vs ~278–279k for docs 5832/5835). Note: the remaining 5832-vs-5835
   differences in this group are decimal-rounding only (e.g. 538,499.64 vs
   538,500) — not material, no action needed on those specifically.
7. **Company 1881 FY2024** — doc 5875 diverges further than the COS/admin
   pattern alone explains: equity.retained_earnings (85,008.6 vs 129,972
   elsewhere) and profit_before_tax (122,278.68 vs 118,518 elsewhere, a real
   ~£3,760 gap, not rounding).
8. **Company 1881 FY2025** — doc 5876 diverges on current_liabilities.total
   (goes NEGATIVE, −178,221 vs 97,627 for the other three — a negative
   liability total is very likely a sign or extraction error) and
   other_operating_income (20 vs 3,448 elsewhere, not a rounding gap).

## NOT REAL DISAGREEMENTS — decimal precision only, no action

Several 5832-vs-5835 pairs (company 1877 FY2025) and several
5873/5874/5875/5877 pairs (company 1881 FY2024/25) differ only by sub-£1
decimal rounding — e.g. revenue 326,227 vs 326,227.25, interest_receivable
739.67 vs 740. Correctly flagged as DISAGREEMENT under the no-approximation
rule, but not worth PDF time on their own. Distinguishable from the genuine
candidates above by delta size.

## STILL OUTSTANDING

Phase 3 (the brief's sampled full-document check, minimum 2 documents per
tier against the PDF, T1 prioritised) has not started. Tier has not been
assigned to any document from content — `document_category` is explicitly
not authoritative per the brief. Company 1880's 10 documents (5857, 5860–5863,
5865–5869) all carry `document_category = "Restored"`, which gives no tier
signal at all; these need a first read just to classify before Phase 3
sampling can pick which ones to check in full.
---
