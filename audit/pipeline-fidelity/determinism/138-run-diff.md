# Determinism Diff — TC 138 (Two Identical Runs)

| Expert | Field | Run 1 | Run 2 | Δ |
|---|---|---|---|---|
| deal_structure | score | null | 35 | 35.00 |
| synthesis | score | null | null | identical |
| operational | score | 58 | 58 | identical |
| risk | score | 45 | 48 | 3.00 |
| financial | score | 62 | 62 | identical |
| sector | score | 68 | 68 | identical |
| qoe | score | 45 | 45 | identical |
| qoe | adjusted_ebitda.conservative | -10495 | -10495 | identical |
| qoe | adjusted_ebitda.base | 16266 | 16266 | identical |
| qoe | adjusted_ebitda.optimistic | 36082 | 36082 | identical |
| valuation | score | null | 55 | 55.00 |

**Noise floor (largest movement between two identical runs)**: £55.00

Anything smaller than £55.00 in a dev-vs-live comparison is sampling noise, not a defect.
