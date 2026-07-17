export function buildDocumentClassificationPrompt(): string {
  return `You specialise in analysing markdown content to identify the type of company information provided.
You should identify only one type of markdown content closest to one of the following, unless the type of file is a company accounts file:

- A. Profit & loss analysis
This type of markdown will provide information to parse the following JSON structure:
- revenue
- cost_of_sales
- gross_profit
- administrative_expenses
- other_operating_income
- operating_profit
- interest_receivable
- interest_payable
- profit_before_tax
- tax
- net_profit

- B. Balance Sheet analysis
This type of markdown will provide information to parse the following JSON structure:
- fixed_assets
- debtors
- cash_at_bank
- total_current_assets
- creditors_within_one_year
- net_current_assets
- total_assets_less_current_liabilities
- creditors_after_one_year
- net_assets
- called_up_share_capital
- profit_and_loss_reserve

-C. Asset register
This type of markdown will provide information to parse at least some of the following JSON structure:
1. **total_assets_cost** – Total historical purchase cost of all tangible assets.
2. **total_accumulated_depreciation** – Total depreciation charged to date.
3. **total_net_book_value** – Total current book value of all assets (cost minus depreciation).
4. **asset_breakdown** – A breakdown by asset category, including:
   - category
   - cost
   - accumulated_depreciation
   - net_book_value
5. **recent_additions_summary** – List of any categories where new assets were added during the year, including:
   - category
   - additions_amount
6. **depreciation_this_year** – Total depreciation charged during the most recent year (if available).

-D. Sales ledger
This type of markdown will provide information to parse at least some of the following JSON structure:
1. **total_invoice_count** – Total number of invoices
2. **total_invoice_value** – Sum of all invoice amounts
3. **total_amount_paid** – Sum of all payments made
4. **total_outstanding** – Total unpaid balance (invoice amount - amount paid)
5. **invoice_status_summary** – Total count and value by status:
   - Paid
   - Part Paid
   - Unpaid
6. **customer_exposure** – A breakdown by customer showing:
   - total_invoiced
   - total_paid
   - total_outstanding
7. **observations** – Up to 3 bullet-point insights, such as:
   - Overdue invoices
   - Part-payment trends
   - High customer concentration


-E. Staff matrix
This type of markdown will provide information to parse at least some of the following JSON structure:
1. **total_employee_count** – Total number of employees listed
2. **total_annual_payroll** – Sum of all salaries
3. **average_salary** – Mean salary across all staff
4. **employment_type_breakdown** – Count of Full-Time and Part-Time employees
5. **status_summary** – Count of employees by employment status (e.g., Active, Maternity Leave)
6. **longest_tenured_employees** – Top 3 longest-serving employees, include:
   - name
   - role
   - start_date
   - years_of_service
7. **observations** – Up to 3 summary bullet points, such as:
   - "Majority of staff are active full-time employees."
   - "One employee has been with the company for over 6 years."
   - "Only one employee is currently on maternity leave."

IMPORTANT: Respond with a JSON object in the following format:
{
  "document_types": ["type1", "type2", ...],
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of why this classification was made",
  "is_information_memorandum": true | false,
  "im_reason": "One-line reason if is_information_memorandum is true, otherwise null"
}

Where document_types is an array containing one or more of the following values:
- "profit_and_loss" (for a standalone Profit & Loss document)
- "balance_sheet" (for a standalone Balance Sheet document)
- "asset_register" (for Asset register)
- "sales_ledger" (for Sales ledger)
- "staff_matrix" (for Staff matrix)
- "company_accounts" (for statutory accounts or annual accounts files containing multi-year financial statements — use this even if the file contains P&L and balance sheet data)
- "none" (if the document does not match any of the above types)

For Company Accounts / statutory accounts files return ["company_accounts"] only — do not return profit_and_loss or balance_sheet for these files.
For single-purpose standalone documents return only one type.

If the document cannot be classified into any of the above categories, return ["none"].

For is_information_memorandum: set to true if any of the following apply:
- The document has a title or header containing "Information Memorandum" or "IM"
- The document contains broker branding, an executive summary, growth opportunities, or products & services narrative typical of a marketing pack
- Financial figures are presented as a management summary only, without underlying statutory detail
- The document includes forecast or projected years alongside historic financials
Otherwise set to false and set im_reason to null.`;
}
