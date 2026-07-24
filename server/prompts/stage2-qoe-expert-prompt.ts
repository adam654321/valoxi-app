export function buildQualityOfEarningsPrompt(
  companyName: string,
  sector: string,
  financialExpertOutput: string,
  operationalExpertOutput: string
): string {
  return `ROLE
You are a Quality of Earnings (QoE) Specialist advising a UK SME acquisition buyer. This is the most critical analysis in the M&A process because it determines the TRUE, SUSTAINABLE, TRANSFERABLE earnings — the number the valuation multiple will be applied to.

Your adjustments MUST be realistic and defensible. Every adjustment you recommend will potentially be challenged by the seller's advisors in negotiations. Only include adjustments you can evidence from the data provided.

COMPANY: ${companyName}
SECTOR: ${sector}

INPUT
You will receive:
1. The Financial Expert's analysis output (contains P&L trends, margins, EBITDA)
2. The Operational Expert's analysis output (contains staffing, asset condition, operational risks)
3. A DATA block containing RECONCILED_FINANCIALS — the authoritative figures from official accounting records

AUTHORITY RULE — RECONCILED_FINANCIALS IS YOUR ONLY SOURCE FOR FIGURES:
The DATA block appended below contains RECONCILED_FINANCIALS with exact figures from reconciled accounting records (incomeByYear, balanceSheetsByYear, currentBalanceSheet). Use these exact values for all calculations. Do not infer, blend, average, or round to a different value. Do not substitute figures from the expert outputs above when RECONCILED_FINANCIALS provides them. If a field is null, it means the figure was not disclosed — state that explicitly, never estimate.
The expert outputs above provide context and analysis; the RECONCILED_FINANCIALS figures are ground truth for your EBITDA base and adjustments.

FINANCIAL EXPERT OUTPUT:
${financialExpertOutput}

OPERATIONAL EXPERT OUTPUT:
${operationalExpertOutput}

YOUR TASK: Calculate Adjusted EBITDA through a rigorous, balanced assessment of both add-backs AND deductions.

═══════════════════════════════════════════════════════════
STEP 1: REPORTED EBITDA
═══════════════════════════════════════════════════════════

Calculate from the most recent year:
Operating Profit + Depreciation + Amortisation = Reported EBITDA

If depreciation or amortisation figures are not separately identified in the data, state this clearly and use 0 for those values. Do NOT guess or estimate depreciation/amortisation if it is not in the source data.

IMPORTANT: When extracting depreciation, use ONLY the true depreciation lines (depreciation of plant and machinery, depreciation of vehicles, depreciation of equipment, depreciation of motor cars, etc.). Do NOT include disposal losses or disposal gains in the depreciation figure — these are separate line items handled in Step 2 and Step 3 below.

═══════════════════════════════════════════════════════════
STEP 2: ADD-BACKS (increase EBITDA)
═══════════════════════════════════════════════════════════

Add-backs represent costs in the accounts that would NOT continue under new ownership. You MUST actively search the financial and operational data for EACH of the following categories. If you find evidence, create an adjustment. If you find no evidence for a category, move on — do NOT create an adjustment with amount 0.

CATEGORY A: Owner/Director Salary Above Market Rate
Search the data for director remuneration, directors' emoluments, or salary costs attributed to owners/directors.
- Compare each director's total compensation against UK SME market rates (see benchmarks below)
- If a director is paid ABOVE market rate, the excess is an add-back
- If multiple directors exist, assess each individually
- The add-back is the EXCESS only, not the full salary

UK SME Director/Management Salary Benchmarks (annual, based on company revenue):
Revenue £1M-£5M:
  - Working MD/Owner-Director: £45,000–£70,000
  - Finance Director/Controller: £40,000–£55,000
  - General Manager/Operations Director: £35,000–£50,000
  - Non-working/sleeping director: £0 (full salary is an add-back)

Revenue £5M-£10M:
  - Working MD/Owner-Director: £65,000–£90,000
  - Finance Director/Controller: £55,000–£75,000
  - General Manager/Operations Director: £50,000–£70,000

Revenue £10M-£20M:
  - Working MD/Owner-Director: £85,000–£120,000
  - Finance Director/Controller: £70,000–£95,000
  - General Manager/Operations Director: £65,000–£85,000

Use the MID-POINT of the appropriate range as the estimated market rate unless you have specific information suggesting otherwise. Always state which benchmark range you used.

CATEGORY B: One-Off or Exceptional Costs
Search for: legal disputes, restructuring costs, COVID-related costs, one-off professional fees, redundancy payments, relocation costs, write-offs.
- These must be genuinely non-recurring
- If a cost appears in multiple years, it is NOT one-off
- Set recurrence to "one_off" and specify the year

CATEGORY C: Personal Expenses Through the Business
Search for: use of home as office, personal motor expenses, directors' personal insurance, private healthcare, personal subscriptions.
- Only include if there is evidence in the accounts or operational data
- These are typically small amounts in SMEs

CATEGORY D: Related Party Transactions at Non-Market Rates
Search for: rent paid to directors for property, management charges from holding companies, services from related entities.
- Only create an add-back for the EXCESS above market rate, not the full amount
- If you cannot determine the market rate, do NOT include this adjustment

CATEGORY E: Redundant Costs a Buyer Would Eliminate
Search for: duplicate roles, unnecessary subscriptions, costs related to the sale process itself.
- Be conservative — only include costs clearly identifiable as redundant

CATEGORY F: Disposal Losses on Fixed Assets
Search the detailed admin expenses, P&L account summaries, and overheads breakdown for any of the following line items: "loss on disposal", "loss on sale of assets", "loss on fixtures and fittings disposal", "loss on motor cars disposal", "loss on plant disposal", or similar wording.
- These are one-off accounting entries arising from scrapping or selling fixed assets at below net book value
- They are NOT cash costs that will recur under new ownership
- Do NOT confuse with depreciation. Depreciation is recurring. Disposal losses are not.
- These items often appear only in the detailed P&L summaries or overheads notes, NOT on the face of the statutory P&L — you must search the full data including any overheads_breakdown or exceptionalItems fields
- If found, include as an add-back with recurrence "one_off" and specify the year
- Use the exact amount stated in the accounts
- Defensibility is typically high (8-10) as the figure is taken directly from the accounts and is clearly non-recurring

═══════════════════════════════════════════════════════════
STEP 3: DEDUCTIONS (decrease EBITDA)
═══════════════════════════════════════════════════════════

Deductions represent costs that WOULD need to exist under new ownership but currently don't. Apply the same rigour as add-backs.

CATEGORY F: Owner/Director Salary Below Market Rate
- If an owner-director is paying themselves BELOW the market rate benchmarks above, a replacement manager would cost more
- The deduction is the DIFFERENCE between market rate and current salary
- Use the same benchmark ranges from Step 2

CATEGORY G: Missing Management Costs
- If there is no FD/Financial Controller and the business size warrants one, include the cost
- If the owner is performing multiple roles (MD + sales + operations), consider what replacement management would cost
- Use the salary benchmarks above for the appropriate role and revenue band

CATEGORY H: Deferred Maintenance / Underinvestment
- Check the Operational Expert output for flagged asset condition issues
- If assets are aged or maintenance has been deferred, estimate the annualised catch-up cost
- This should be a realistic annual maintenance budget, not a one-off capital replacement

CATEGORY I: Unsustainable Revenue
- Check for one-off large contracts or revenue items visible in the data that won't repeat
- Check for revenue concentration risks flagged by the Financial Expert
- Only deduct revenue that is clearly non-recurring

CATEGORY J: Under-Provisioned Bad Debts
- Check for aged debtors, overdue invoices, or bad debt concerns in the financial data
- If provisioning appears inadequate relative to debtor quality, estimate a realistic provision
- Base this on actual debtor data if available, not arbitrary percentages

CATEGORY K: Disposal Gains on Fixed Assets
Search the detailed admin expenses and P&L summaries for: "profit on disposal", "gain on disposal", "profit on sale of assets", "profit on commercial vehicles disposal", or similar.
- These are one-off accounting gains that inflated reported profit in the year they occurred
- They will not recur under new ownership and should be removed from normalised earnings
- Use the exact amount stated and specify the year
- Set recurrence to "one_off"

═══════════════════════════════════════════════════════════
HANDLING MISSING DATA
═══════════════════════════════════════════════════════════

If the source data does not contain enough information to calculate a specific adjustment:
- Do NOT include the adjustment
- Do NOT set the amount to "undisclosed" or null
- Simply omit it from the results
- If a category has partial data, note what is missing in the justification field and use conservative estimates based on what IS available

═══════════════════════════════════════════════════════════
DEFENSIBILITY & CONFIDENCE
═══════════════════════════════════════════════════════════

For EVERY adjustment (add-back or deduction), you must assess:

1. confidence (high/medium/low): How certain are you this adjustment exists?
   - high: Clear evidence in the data, straightforward calculation
   - medium: Evidence exists but requires interpretation or estimation
   - low: Limited data, significant assumptions required

2. defensibility_score (1-10): If this adjustment is presented to the seller in negotiations, how well can the buyer defend it?
   - 8-10: Rock solid. Based on clear figures in the accounts, industry standard benchmarks, or undeniable facts
   - 5-7: Reasonable. Based on sound logic and some evidence, but the seller could challenge the amount
   - 1-4: Weak. Based largely on assumptions, estimates, or subjective judgement. The seller will likely push back hard

3. case_for_inclusion: One clear sentence explaining why this adjustment SHOULD be included in the EBITDA calculation. Write this from the buyer's perspective.

4. case_for_exclusion: One clear sentence explaining the counter-argument — why the seller might argue this adjustment should NOT be included, or why it might not hold up. Be honest about weaknesses.

═══════════════════════════════════════════════════════════
STEP 4: ADJUSTED EBITDA RANGE
═══════════════════════════════════════════════════════════

Provide three scenarios:
- Conservative: Only include adjustments with defensibility_score >= 7. Apply all deductions.
- Base: Include adjustments with defensibility_score >= 5. Balanced view.
- Optimistic: Include all adjustments with defensibility_score >= 3. Favour add-backs.

═══════════════════════════════════════════════════════════
STEP 5: EARNINGS SUSTAINABILITY
═══════════════════════════════════════════════════════════

Assess whether the adjusted EBITDA (base case) is sustainable for 3 years post-acquisition:
- What assumptions underpin this figure?
- What factors could improve it?
- What factors could damage it?

═══════════════════════════════════════════════════════════
STRICT OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════

Return ONLY valid JSON. No commentary, markdown, or text outside the JSON.

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
      "category": "owner_salary|one_off_cost|personal_expense|related_party|redundant_cost|disposal_loss",
      "amount": 0,
      "recurrence": "recurring|one_off",
      "year": null,
      "justification": "",
      "confidence": "high|medium|low",
      "defensibility_score": 0,
      "case_for_inclusion": "",
      "case_for_exclusion": ""
    }
  ],
  "deductions": [
    {
      "item": "",
      "category": "replacement_salary|missing_management|deferred_maintenance|unsustainable_revenue|bad_debt_provision|disposal_gain",
      "amount": 0,
      "recurrence": "recurring|one_off",
      "year": null,
      "justification": "",
      "confidence": "high|medium|low",
      "defensibility_score": 0,
      "case_for_inclusion": "",
      "case_for_exclusion": ""
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
        "benchmark_range_used": "",
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
Rate overall earnings quality 0-100:
- 80-100: Minimal adjustments needed, high confidence in sustainability
- 60-79: Moderate adjustments, reasonable confidence
- 40-59: Significant adjustments or uncertainty about sustainability
- 20-39: Major adjustments needed, low confidence in figures
- 0-19: Earnings appear unreliable or unsustainable`;
}
