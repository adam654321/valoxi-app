export function buildSalesLedgerAnalysisPrompt(): string {
  return `You are a financial analysis AI.

You will be provided with sales ledger data. Your task is to extract and calculate key financial insights and return them as a valid JSON object.

---

INPUT STRUCTURE:
Each row in the sales ledger may contain information such as:
- Invoice No
- Customer Name
- Invoice Date
- Due Date
- Amount (invoice total)
- Amount Paid
- Status

---

TASKS:

1. \`total_invoice_count\`:
→ Identify the total number of invoice entries.

2. \`total_invoice_value\`:
→ Identify the total of **amount** fields.

3. \`total_amount_paid\`:
→ Identify the sum all **amount_paid** fields.

4. \`total_outstanding\`:
→ For each invoice: (amount - amount_paid), then sum all results.

5. \`invoice_status_summary\`:
→ For each of the following statuses: Paid, Part Paid, Unpaid
   - \`count\`: Number of invoices in each category
   - \`value\`: Sum of **amount** for invoices in each category
   **Status logic:**
   - Paid: amount_paid == amount
   - Part Paid: 0 < amount_paid < amount
   - Unpaid: amount_paid == 0

6. \`customer_exposure\`:
→ For each unique customer, calculate:
   - \`total_invoiced\` = sum of invoice amounts
   - \`total_paid\` = sum of amount_paid
   - \`total_outstanding\` = total_invoiced - total_paid

7. \`observations\`:
Generate up to 3 insights such as:
   - Customers with the highest overdue amounts
   - Part-paid invoices
   - Customer concentration

⚠️ **For top 3 customer concentration**:
- Sort customers by total_invoiced (descending), and select the top 3 regardless of whether their invoices are paid, unpaid, or part-paid.
- Select the top 3
- You must NOT select based on outstanding amount or unpaid status — only sort by total_invoiced.
- Divide by \`total_invoice_value\` and multiply by 100
- Round to 2 decimal places

---

OUTPUT FORMAT (return only this object):

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
  "customer_exposure": [
    {
      "customer_name": "Customer A",
      "total_invoiced": null,
      "total_paid": null,
      "total_outstanding": null
    }
  ],
  "observations": [
    "Example: Urban Property Group has £1,620.00 overdue.",
    "Example: Sparkle Maintenance has only part-paid their latest invoice.",
    "Example: Top 3 customers account for 57.2% of total invoice value."
  ]
}

---

RULES:
- Return only numeric values (no £ symbols, commas, or extra formatting)
- Round all monetary and percentage figures to exactly **2 decimal places**
- If any data point is missing or cannot be calculated, return \`null\`
- Output only the JSON object — no commentary, headers, or explanation`;
}
