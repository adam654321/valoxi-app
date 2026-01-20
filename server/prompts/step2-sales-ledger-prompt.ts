export function buildSalesLedgerAnalysisPrompt(): string {
  return `You are a financial analysis AI. Extract key financial insights from this sales ledger and return JSON.

TASKS:
1. total_invoice_count - number of invoices
2. total_invoice_value - sum of invoice amounts  
3. total_amount_paid - sum of amounts paid
4. total_outstanding - remaining balance (total_invoice_value - total_amount_paid)
5. invoice_status_summary - breakdown by status:
   - Paid: amount_paid == amount
   - Part Paid: 0 < amount_paid < amount
   - Unpaid: amount_paid == 0
6. top_5_customers - TOP 5 customers by total_invoiced (descending), with total_invoiced, total_paid, total_outstanding
7. observations - 2-3 key insights about overdue amounts, customer concentration, or payment patterns

OUTPUT FORMAT:
{
  "total_invoice_count": null,
  "total_invoice_value": null,
  "total_amount_paid": null,
  "total_outstanding": null,
  "invoice_status_summary": {
    "Paid": { "count": null, "value": null },
    "Part Paid": { "count": null, "value": null },
    "Unpaid": { "count": null, "value": null }
  },
  "top_5_customers": [
    { "customer_name": "", "total_invoiced": null, "total_paid": null, "total_outstanding": null }
  ],
  "observations": []
}

RULES:
- Return numeric values only (no currency symbols)
- Round to 2 decimal places
- Return null for missing data
- Output only the JSON object`;
}
