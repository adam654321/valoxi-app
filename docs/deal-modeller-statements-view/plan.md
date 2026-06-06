# Deal Modeller — Three-Statement View (#202): Plan

Status: scoped 2026-06-06. Additive. Balance Sheet now, Cashflow later.
Related: assessment.md, removals.md.

## Slices

### Slice 1 — Tabs shell (no calc change)
- In DealModeller.tsx, replace the single PLSummarySection render in the financials area with a tabbed container.
- Tab 1 "Income Statement": existing PLSummarySection, unchanged, moved into TabsContent, same props.
- Tab 2 "Balance Sheet": empty-state placeholder for this slice, filled in Slice 2.
- Controlled active-statement state. md+ renders TabsList; below md renders a Select; content stacks.
- Adjustments, Valuation, Funding, Payment Terms, Viability stay outside and below the tabs, unchanged.
- V-check: TSC still 1 error; app builds; P&L renders inside tab 1 identically; tab and dropdown switch work.

### Slice 2 — Balance Sheet render
- New client/src/components/deal-modeller/BalanceSheetSection.tsx.
- Reads the /financials payload: periods + balanceSheets. Extend the DealModeller FinancialsData type to include balanceSheets (data already returned).
- Columns: periods that have a balance_sheets row, oldest to newest, matching P&L order. No Average column.
- Rows grouped: Fixed Assets, Current Assets, Current Liabilities, Long-term Liabilities, Equity, with stored total_* subtotals and a computed Net Assets row.
- Hide-null: a row renders only if non-null in at least one shown period. A fully empty group collapses.
- Styling and horizontal scroll mirror PLSummarySection.
- V-check: TSC still 1 error; balance sheet renders for a company with data (dev company 23); null rows hidden; totals present; scroll works narrow.

## Deferred
- Cashflow tab (tab 3). From scratch. When picked up: derived indirect cash flow from P&L plus year-on-year balance-sheet movements (needs 2+ BS periods, which most deals have). Not extraction. Out of scope for #202.

## Risks
- Data-source split (expert vs raw): see assessment flags. Low for an additive view.
- Nested tabs on mobile: handled by the dropdown.
- No schema change, no calculation change, no migration.

## Sequencing
Slice 1, V-check, authorise, then Slice 2. One concern per slice, no chaining. Each Replit prompt ends "Stop after V-check and report results."
