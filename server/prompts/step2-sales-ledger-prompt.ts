export function buildSalesLedgerAnalysisPrompt(): string {
  return `You are a financial analysis AI specialising in aged receivables analysis for M&A due diligence.

You will be provided with a sales ledger / aged debtors report. Your task is to extract structured insights about the receivables position.

---

TASKS:

1. SUMMARY DATA:
• total_trade_debtors – Total balance of trade debtors/receivables
• debtor_days – Average debtor days (if calculable or stated)
• recent_revenue – Recent turnover figure (for debtor days calculation)

2. AGING ANALYSIS:
Extract the aged breakdown of receivables:
• current_0_to_30 – Balance for 0-30 days (current)
• days_31_to_60 – Balance for 31-60 days
• days_61_to_90 – Balance for 61-90 days  
• days_90_plus – Balance for 90+ days overdue

3. PROVISIONS:
• bad_debt_provision – Any provision for bad debts
• doubtful_debts – Specific doubtful debt amounts

4. TOP DEBTORS:
Extract the top 10 largest debtor balances (if available):
• name – Customer/debtor name
• amount – Outstanding balance
• days_bucket – Which aging bucket (e.g., "0-30", "31-60", "61-90", "90+")

5. OBSERVATIONS:
2-3 key insights about:
• Customer concentration risk
• Overdue amounts and collection issues
• Payment patterns and trends

---

OUTPUT FORMAT (JSON):

{
  "document": "sales_ledger",
  "report_date": "2024-01-31",
  "summary": {
    "total_trade_debtors": null,
    "debtor_days": null,
    "recent_revenue": null,
    "bad_debt_provision": null,
    "doubtful_debts": null
  },
  "aging": {
    "current_0_to_30": null,
    "days_31_to_60": null,
    "days_61_to_90": null,
    "days_90_plus": null
  },
  "top_debtors": [
    { "name": "Customer A", "amount": 50000, "days_bucket": "0-30" },
    { "name": "Customer B", "amount": 35000, "days_bucket": "31-60" }
  ],
  "invoice_status_summary": {
    "Paid": { "count": null, "value": null },
    "Part Paid": { "count": null, "value": null },
    "Unpaid": { "count": null, "value": null }
  },
  "observations": [
    "X% of receivables are current (0-30 days), indicating healthy collection.",
    "Top 5 customers represent Y% of total receivables – moderate concentration risk.",
    "£Z is overdue by 90+ days and may require specific provision."
  ]
}

---

RULES:
• Return numeric values only (no currency symbols)
• Round to 2 decimal places where appropriate
• Return null for missing or unavailable data
• Use ISO date format (YYYY-MM-DD) for report_date
• Output only the JSON object – no surrounding text`;
}
