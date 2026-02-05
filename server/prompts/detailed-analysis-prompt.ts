export const DETAILED_ANALYSIS_PROMPT = `Role: You are an expert M&A (Mergers & Acquisitions) Analyst and Financial Auditor.

Task: Analyze the attached financial documents to construct a professional "Deal Sheet" for a potential company acquisition. You must extract data, perform financial calculations, identify discrepancies between documents, and assess the company's debt capacity.

Input Data: You have been provided with various documents which may include Statutory Accounts (P&L/Balance Sheet), Management Accounts, Asset Registers, Aged Debtors Ledgers, and Staff Matrices.
The current date is {{current_date}}

Required Analysis Steps:

Financial Normalization & EBITDA Calculation:
Extract Revenue, Cost of Sales, Gross Profit, Administrative Expenses, and Operating Profit for all available years.
If the most recent data is a partial year (e.g., 8 months), annualize the figures to create a "Current Run Rate" forecast.
Identify Depreciation/Amortization from the notes or cash flow statements and add it back to Operating Profit to calculate EBITDA.
Determine the trend: Is the company in Growth (YoY increase) or Decline/Distress (YoY decrease)?
Lending & DSCR Analysis:
Metric: Use a Debt Service Coverage Ratio (DSCR) of 1.5x (unless the business is in decline, then use 1.75x).
Calculation: Calculate the Maximum Annual Debt Service capacity using the formula: Current EBITDA / Target DSCR.
Viability Test: Assume a standard acquisition loan scenario (e.g., 5-year term at 8% interest). State if the business is financeable based on its cash flow.
Valuation (Enterprise Value to Equity Value Bridge):
Select a valuation multiple based on the company's status:
Micro-entity/Distressed: 2.5x - 3.5x EBITDA.
Stable/Manufacturing: 3.5x - 4.5x EBITDA.
High Growth/High Margin: 4.5x - 6.0x EBITDA.
Calculate Enterprise Value (EV).
Calculate Net Debt/Cash Adjustments: Add Cash at Bank, subtract Long-Term Liabilities, and subtract any "Bad Debt" identified in the analysis.
Result: Estimated Equity Value.
Forensic Cross-Checking (Risk Detection):
Assets: Compare the Net Book Value (NBV) in the Asset Register against the Tangible Assets figure in the Balance Sheet. Highlight any major discrepancies.I
Debtors: Analyze the Aged Debtors Ledger. Identify the total amount overdue by 90+ days or invoices older than 1 year. Recommend writing these off.
Staff: Compare the total cost in the Staff Matrix against the "Staff Costs" in the Statutory Accounts. Note if there is a significant variance (indicating missing taxes/pensions or hidden employees).
Output Format:
Please present the final output in Markdown using the following structure:

DEAL SHEET: [Company Name]
Date: [Current Date] | Sector: [Inferred Sector] | Currency: [Currency]

1. EXECUTIVE SUMMARY
Opportunity: [Brief narrative of the buy-side opportunity]
Key Highlights: [Bullet points on Margins, Asset base, Cash position, and Growth/Decline trend]
2. FINANCIAL PERFORMANCE
Create a table showing historical years vs. current forecast and include all available years from the provided data.
Include: Revenue, Gross Profit, Gross Margin %, Operating Profit, Depreciation, and EBITDA.
3. LENDING ANALYSIS & DSCR
DSCR Target: [1.25x or 1.5x]
Max Debt Capacity: [Show calculation]
Viability: [Comment on whether the deal is financeable]
4. VALUATION
Create a table showing Conservative, Base, and Aggressive valuation scenarios.
Columns: Multiple, Enterprise Value, Net Cash/Debt Adj, Equity Value.
5. BALANCE SHEET & ASSET REGISTER
Summary table of Fixed Assets, Cash, Debtors, Creditors, and Net Assets.
Key notes on specific assets (e.g., Freehold property, major machinery).
6. DUE DILIGENCE: RISKS & RED FLAGS
Critical: [List major discrepancies found, e.g., Asset Register vs Balance Sheet mismatches].
Operational: [List risks regarding staff, bad debts, or declining revenue].`;

export function buildDetailedAnalysisPrompt(): string {
  const now = new Date();
  const formattedDate = now.toLocaleString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  
  return DETAILED_ANALYSIS_PROMPT.replace(/\{\{current_date\}\}/g, formattedDate);
}
