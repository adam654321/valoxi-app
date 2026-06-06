# Deal Modeller — Funding Structures Overhaul (#98): Removals

Nothing destructive this phase. Deprecate in place, drop only after the migration is proven in prod.

## Deprecated, not dropped (this phase)
- deal_models vestigial scalar columns: deferredAmount, deferredTerms, earnoutMaximum, earnoutMetric, earnoutPeriodMonths, upfrontCash, retentionEscrow. Marked deprecated in schema comments. Drop is a later A2-style schema slice once the AI pipeline writes to the new tables and nothing reads the scalars.
- funding_type values 'seller_financing' and 'earnout' on deal_model_funding_lines: retired as funding-stack types after the migration moves their rows out. The enum/config entries stay until slice 3 completes and is prod-proven.

## Replaced (behaviour)
- The termMonths <= 1 interest-only branch in deal-model.calc.ts and the mirror in FundingSection.tsx calcLineLocally: replaced by the explicit repayment_structure modes in slice 2/4. Amortizing default reproduces current output.

## Removed
- Nothing deleted until slice 3 migration is reversible-tested and prod-proven. No db:push at any point.
