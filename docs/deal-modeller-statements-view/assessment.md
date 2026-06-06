# Deal Modeller — Three-Statement View (#202): Assessment

Status: assessed 2026-06-06 (read-only). Decision: Balance Sheet now, Cashflow deferred. Two tabs at launch.
Owner: Adam. Architect: Claude (relay to Replit).

## Goal
Add a tabbed financials view inside the DealModeller financials section: Income Statement | Balance Sheet. Additive only. No change to existing deal-model calculations. Cashflow is a later tab.

## Where the financials live
- client/src/components/target-company/DealModeller.tsx (financials area).
- Existing P&L surface: client/src/components/deal-modeller/PLSummarySection.tsx, titled "What Does This Business Earn?". Rows = line items, columns = statutory periods oldest to newest, plus an Average column. Already wrapped in overflow-x-auto.
- Adjustments, Valuation, Funding, Payment Terms, Viability are NOT financial statements and stay outside the tabs.

## Data path (confirmed live)
- Modeller calls GET /api/v2/financial-data/company/:id/financials. Response includes periods, incomeStatements, balanceSheets, staffData, loans, agedDebtors, adjustments. balanceSheets is already in the payload, just not typed or rendered in DealModeller.
- Income statement display in the modeller prefers the financial-expert JSON (expert_analysis_results.analysisData.yearly_metrics), falling back to the income_statements table. The expert output is P&L only; yearly_metrics carries no balance-sheet fields.
- The Balance Sheet tab must read the raw /financials balanceSheets, not the expert path.

## Extraction and storage (confirmed)
- Balance sheet extracted by server/prompts/step2-balance-sheet-prompt.ts. A Company Accounts upload auto-expands to run both profit_and_loss and balance_sheet step2 analysis.
- file-analysis.service.ts normalises every successful step2 result via financialDataService.processExtractedData then processBalanceSheet, writing the balance_sheets table on upload. Live, automatic.
- No cashflow statement exists anywhere: no table, no prompt, no processExtractedData branch, no endpoint, no UI. The only cash_flow hits are a portal document-type label and DD-requirement seed text. value-creation.calc.ts free-cash-flow is a different feature. A cashflow statement would be built from scratch.

## Data state
- Dev: balance_sheets 72 rows, income_statements 72 rows, fully paired. 14 companies with 2+ BS periods. Company 23 has 6 clean statutory years.
- Prod: balance_sheets 469 rows. Subtotals well covered (total_current_assets 441, total_current_liabilities 441, total_long_term_liabilities 435, total_equity 458, retained_earnings 438, share_capital 419, cash 424). Sparse but legitimate: leasehold 38, amounts_owed_by_directors 51, hire purchase 90-91, vat 103, freehold 73.
- Implication: a fixed full-table render is mostly blank for any one company. Render must hide null rows.

## Locked design decisions
- Two tabs now: Income Statement (existing PLSummarySection, unchanged, relocated into tab 1) and Balance Sheet (new). Cashflow added as tab 3 when built.
- Balance Sheet mirrors the P&L: line items as rows, periods as columns, grouped (Fixed Assets / Current Assets / Current Liabilities / Long-term Liabilities / Equity) with stored total_* subtotal rows and a computed Net Assets check.
- Hide-null: a line-item row renders only if non-null in at least one shown period. No hardcoded whitelist. Columns driven off periods that have a balance_sheets row, so empty periods never render a column.
- No Average column on the Balance Sheet.
- Horizontal scroll reused from the P&L pattern.
- Responsive: tabs on md+, a Select dropdown below md, content stacks.

## Flags
- Data-source split: when the expert path is active, the Income Statement tab may show expert-derived figures while the Balance Sheet tab shows raw data. Same source documents normally, two AI passes that can differ. Acceptable for an additive view.
- Nested tabs: DealModeller is itself a tab in target-company-detail; the statements tabs nest inside it. The mobile dropdown avoids stacked tab rows.

## Baseline at assess
- TSC: 1 pre-existing error (server/services/portal.service.ts:81). Any other = regression.
- git: clean, HEAD c420b2e.
