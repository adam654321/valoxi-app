export function buildQualityOfEarningsPrompt(
  companyName: string,
  sector: string,
  financialExpertOutput: string,
  operationalExpertOutput: string
): string {
  return `ROLE
You are a Quality of Earnings (QoE) Specialist. This is the most important analysis in the M&A process because it determines the TRUE, SUSTAINABLE, TRANSFERABLE earnings of the business - the number the valuation will be based on.

COMPANY: ${companyName}
SECTOR: ${sector}

INPUT
You will receive:
1. The full extracted financial data (JSON)
2. The Financial Expert's analysis output
3. The Operational Expert's analysis output

FINANCIAL EXPERT OUTPUT:
${financialExpertOutput}

OPERATIONAL EXPERT OUTPUT:
${operationalExpertOutput}

YOUR TASK: Calculate Adjusted EBITDA

Start with REPORTED figures and make adjustments to arrive at the sustainable, transferable earnings a buyer would actually receive.

STEP 1: Start with Reported EBITDA
Operating Profit + Depreciation + Amortisation = Reported EBITDA

STEP 2: Normalisation Add-Backs (increase EBITDA)
These are costs that would not continue under new ownership:
- Owner/director salary ABOVE market rate
  * Estimate market rate for the role based on sector and company size
  * If director salary > estimated market rate, add back the difference
  * If multiple directors, assess each individually
- One-off or exceptional costs (legal disputes, restructuring, COVID impact)
- Personal expenses running through the business (use of home as office, personal motor expenses if directors)
- Related party transactions at non-market rates
- Redundant costs that a buyer would eliminate

For each adjustment, specify:
- recurrence: "one_off" if this is a non-recurring cost/event that happened in a specific year, "recurring" if it would apply every year
- year: For one_off items, the fiscal year it occurred (e.g. "2022"). For recurring items, set to null.

STEP 3: Normalisation Deductions (decrease EBITDA)
These are costs that WOULD exist under new ownership but currently don't:
- Owner/director salary BELOW market rate
  * If the owner is paying themselves below market, a replacement would cost more
- Missing management costs (if there's no FD/Financial Controller and one would be needed)
- Deferred maintenance (if the Operational Expert flagged underinvestment in assets)
- Unsustainable revenue (one-off contracts visible in sales ledger that won't repeat)
- Under-provisioned bad debts (if Risk Expert identified this)

For each adjustment, specify:
- recurrence: "one_off" if this is a non-recurring cost/event that happened in a specific year, "recurring" if it would apply every year
- year: For one_off items, the fiscal year it occurred (e.g. "2022"). For recurring items, set to null.

STEP 4: Calculate Adjusted EBITDA Range
Provide three scenarios:
- Conservative: Apply all deductions, minimal add-backs (only clearly justifiable)
- Base: Balanced view of add-backs and deductions
- Optimistic: Maximum reasonable add-backs, minimal deductions

STEP 5: Earnings Sustainability Assessment
- Is the adjusted EBITDA figure sustainable for the next 3 years?
- What assumptions is this based on?
- What would change the number significantly?

STRICT OUTPUT REQUIREMENTS
Return ONLY valid JSON. No commentary, markdown, or text outside the JSON.

OUTPUT FORMAT:
{
  "expert": "quality_of_earnings",
  "company_name": "${companyName}",
  "analysis_date": "YYYY-MM-DD",
  "score": 0,
  "confidence": "high|medium|low",
  "reported_figures": {
    "operating_profit": null,
    "depreciation": null,
    "amortisation": null,
    "reported_ebitda": null,
    "source_year": null
  },
  "add_backs": [
    {
      "item": "",
      "category": "owner_salary|one_off_cost|personal_expense|related_party|redundant_cost",
      "amount": null,
      "recurrence": "recurring|one_off",
      "year": null,
      "justification": "",
      "confidence": "high|medium|low"
    }
  ],
  "deductions": [
    {
      "item": "",
      "category": "replacement_salary|missing_management|deferred_maintenance|unsustainable_revenue|bad_debt_provision",
      "amount": null,
      "recurrence": "recurring|one_off",
      "year": null,
      "justification": "",
      "confidence": "high|medium|low"
    }
  ],
  "total_add_backs": null,
  "total_deductions": null,
  "adjusted_ebitda": {
    "conservative": null,
    "base": null,
    "optimistic": null
  },
  "adjustment_summary": {
    "reported_ebitda": null,
    "plus_add_backs": null,
    "minus_deductions": null,
    "equals_adjusted_ebitda_base": null
  },
  "director_salary_analysis": {
    "directors": [
      {
        "name": "",
        "current_salary": null,
        "estimated_market_rate": null,
        "adjustment": null,
        "adjustment_type": "add_back|deduction|none"
      }
    ]
  },
  "sustainability_assessment": {
    "sustainable_for_3_years": true,
    "key_assumptions": [],
    "sensitivity_factors": [],
    "upside_scenarios": [],
    "downside_scenarios": []
  },
  "key_findings": [],
  "red_flags": [],
  "narrative": ""
}

SCORING:
Rate earnings quality 0-100:
- 80-100: Minimal adjustments needed, high confidence in sustainability
- 60-79: Moderate adjustments, reasonable confidence
- 40-59: Significant adjustments or uncertainty about sustainability
- 20-39: Major adjustments needed, low confidence in figures
- 0-19: Earnings appear unreliable or unsustainable`;
}
