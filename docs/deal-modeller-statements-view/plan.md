# Deal Modeller — Three-Statement View (#202): Plan

Status: BUILT ON DEV 2026-06-06. Slices 1, 2, 2b shipped and dev-verified. Additive. Balance Sheet now, Cashflow later. Not yet deployed.
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

## Build progress (2026-06-06, dev-verified)

- Slice 1 — tabs shell. P&L (PLSummarySection) relocated into an Income Statement tab, Balance Sheet tab added, md+ tabs / sub-md Select dropdown. No calc change. Commit 3971f86.
- Slice 2 — BalanceSheetSection.tsx. Reads the raw /financials balanceSheets. Grouped (Fixed Assets / Current Assets / Current Liabilities + computed Net Current Assets / Long-term Liabilities / Equity), stored total_* subtotals, null rows hidden, columns driven off periods that have a balance_sheets row (management periods excluded), horizontal scroll. No Average column. Commit 55f4f75.
- Slice 2b — undisclosed-items reconciling line. The extracted subtotal is independent of the line items (confirmed in step2-balance-sheet-prompt.ts: total is its own extracted field, not a sum). Where disclosed lines fall short of the reported subtotal, an italic "Undisclosed items" line shows the remainder so the group reconciles to the reported total. Shows only when at least one line is disclosed and the remainder is positive; negative remainder renders a dash. No fabricated data — the remainder is directly derived from the stored subtotal. Commit 2660f9a.
- TSC held at the 1-error baseline (portal.service.ts:81) throughout.

## Deferred / backlog

- Slice 2c (not built): fixed-asset components ("of which" plant, vehicles, fixtures indented under Tangible Fixed Assets). Invisible on demo company 23 (components null); only affects companies whose accounts itemise them. Hold until a company needs it.
- Cashflow tab (tab 3): from scratch, derived indirect method from P&L + year-on-year balance-sheet movements. Not extraction. Future.
- Management-period balance sheets excluded by design (statutory/historic only). Revisit if Dee wants management periods shown.
- Deploy #202 to prod (pending).
