export const STAGE1_SCREENING_SYSTEM_PROMPT = `ROLE
You are a Senior M&A Screening Analyst. Your task is to produce a rapid go/no-go assessment of a target acquisition company based on structured financial data.

PURPOSE
This is a SCREENING report, not a deep analysis. The buyer is looking at multiple targets and needs to quickly determine whether this company warrants further investigation. Be decisive, not comprehensive.

ANALYSIS RULES
- Work ONLY from the structured JSON data provided. Do not hallucinate numbers.
- If a metric cannot be calculated due to missing data, state "Data Unavailable" and factor this into your confidence rating for that dimension.
- Use British English throughout.
- All monetary values should be formatted with commas (e.g. 1,250,000) but no currency symbols in tables.
- Percentages to 1 decimal place.
- Prioritise company_accounts data for multi-year trends. Use profit_and_loss and balance_sheet for current-period detail.`;

export const STAGE1_SCREENING_USER_PROMPT = `COMPANY: {{company_name}}
SECTOR: {{sector}}
DATA QUALITY SCORE: {{data_quality_score}}/100 (Confidence: {{data_quality_confidence}})

TASK: Assess this company across 6 decision dimensions. For each dimension, provide:
1. A RAG rating: GREEN (positive signal), AMBER (mixed/unclear), RED (negative signal)
2. A score from 0-100
3. A brief explanation (2-3 sentences maximum)

DIMENSION 1: EARNINGS TRAJECTORY
Analyse revenue trend (3-5 years from company_accounts).
Calculate: Revenue CAGR, direction of gross/operating/net margins.
GREEN: Revenue CAGR > 5% AND margins stable or expanding
AMBER: Revenue flat or CAGR 0-5% OR margins contracting slightly
RED: Revenue declining OR margins contracting significantly OR fewer than 2 years data

DIMENSION 2: BALANCE SHEET HEALTH
Analyse from company_accounts trend + current balance_sheet.
Calculate: Current ratio, net assets trend, net asset growth.
GREEN: Current ratio > 1.2 AND net assets growing AND no excessive long-term debt
AMBER: Current ratio 0.8-1.2 OR net assets flat OR moderate debt levels
RED: Current ratio < 0.8 OR net assets declining OR insolvent (negative net assets)

DIMENSION 3: CASH REALITY
Compare net profit to cash position changes across years.
Calculate: Cash at bank trend, operating profit vs cash movement (proxy cash conversion).
GREEN: Cash position growing in line with profits
AMBER: Cash flat despite profits OR moderate mismatch
RED: Cash declining despite reported profits OR negative cash

DIMENSION 4: CUSTOMER RISK
Analyse from sales_ledger data.
Calculate: Top customer as % of total, Herfindahl concentration index if possible, aged debt over 90 days as % of total.
GREEN: No customer > 15% of total AND aged debt 90+ < 10%
AMBER: One customer 15-25% OR aged debt 90+ between 10-20%
RED: Any customer > 25% OR aged debt 90+ > 20% OR insufficient data

DIMENSION 5: ASSET QUALITY
Analyse from asset_register data.
Calculate: NBV as % of gross cost (asset freshness), recent additions (last 24 months) as % of total.
GREEN: NBV/Cost > 50% OR significant recent investment
AMBER: NBV/Cost 25-50% with some recent investment
RED: NBV/Cost < 25% AND no recent investment (capex cliff risk)

DIMENSION 6: PEOPLE & CAPABILITY
Analyse from staff_matrix data.
Calculate: Revenue per employee, payroll as % of revenue, director remuneration as % of total payroll.
GREEN: Revenue per head > sector average AND director costs < 30% of payroll AND headcount > 5
AMBER: Moderate metrics OR director costs 30-50% of payroll
RED: Director costs > 50% of payroll (owner dependency) OR headcount < 3

OVERALL RECOMMENDATION
Based on the 6 dimension scores, provide:
- PROCEED: 4+ GREEN ratings, no RED ratings, overall score >= 65
- PROCEED WITH CAUTION: Mixed ratings, 1-2 RED ratings in non-critical areas, overall score 40-64
- DO NOT PROCEED: 3+ RED ratings OR any RED in Dimensions 1-3 (earnings, balance sheet, cash), overall score < 40

ADDITIONAL OUTPUTS
1. "Key strengths" - Top 3 positive signals (one sentence each)
2. "Key concerns" - Top 3 negative signals or risks (one sentence each)
3. "Questions for seller" - 3-5 specific questions generated from data gaps or anomalies
4. "Comparable context" - Brief note on how this company's metrics compare to typical businesses in the stated sector (use your general knowledge of sector benchmarks)

STRICT OUTPUT REQUIREMENTS
Return ONLY valid JSON. No commentary, markdown, or text outside the JSON.
Output must begin with { and end with }

OUTPUT FORMAT:
{
  "stage": "screening",
  "company_name": "{{company_name}}",
  "sector": "{{sector}}",
  "analysis_date": "YYYY-MM-DD",
  "data_quality_score": {{data_quality_score}},
  "analysis_period": {
    "earliest_year": null,
    "latest_year": null,
    "years_of_data": 0
  },
  "dimensions": {
    "earnings_trajectory": {
      "rag": "GREEN|AMBER|RED",
      "score": 0,
      "revenue_cagr_percent": null,
      "latest_revenue": null,
      "latest_gross_margin_percent": null,
      "latest_operating_margin_percent": null,
      "latest_net_margin_percent": null,
      "margin_direction": "expanding|stable|contracting",
      "explanation": ""
    },
    "balance_sheet_health": {
      "rag": "GREEN|AMBER|RED",
      "score": 0,
      "latest_current_ratio": null,
      "latest_net_assets": null,
      "net_asset_growth_percent": null,
      "long_term_debt": null,
      "explanation": ""
    },
    "cash_reality": {
      "rag": "GREEN|AMBER|RED",
      "score": 0,
      "latest_cash_at_bank": null,
      "cash_trend": "growing|stable|declining",
      "cash_vs_profit_alignment": "aligned|partial|misaligned",
      "explanation": ""
    },
    "customer_risk": {
      "rag": "GREEN|AMBER|RED",
      "score": 0,
      "top_customer_concentration_percent": null,
      "aged_debt_90_plus_percent": null,
      "total_customers": null,
      "explanation": ""
    },
    "asset_quality": {
      "rag": "GREEN|AMBER|RED",
      "score": 0,
      "nbv_to_cost_percent": null,
      "recent_additions_percent": null,
      "total_nbv": null,
      "explanation": ""
    },
    "people_capability": {
      "rag": "GREEN|AMBER|RED",
      "score": 0,
      "headcount": null,
      "revenue_per_employee": null,
      "payroll_to_revenue_percent": null,
      "director_cost_percent_of_payroll": null,
      "explanation": ""
    }
  },
  "overall_score": 0,
  "recommendation": "PROCEED|PROCEED_WITH_CAUTION|DO_NOT_PROCEED",
  "recommendation_justification": "",
  "key_strengths": [],
  "key_concerns": [],
  "questions_for_seller": [],
  "comparable_context": "",
  "executive_summary": ""
}

SCORING:
- overall_score = weighted average of dimension scores
  - Dimensions 1-3 (earnings, balance sheet, cash) weighted at 20% each = 60%
  - Dimensions 4-6 (customer, assets, people) weighted at ~13% each = 40%
- executive_summary: Maximum 300 words. Written as a brief for a time-poor buyer. Lead with the recommendation, then the top reasons for and against.`;

export function buildStage1ScreeningPrompt(
  companyName: string,
  sector: string,
  dataQualityScore: number,
  dataQualityConfidence: string
): { systemPrompt: string; userPrompt: string } {
  const userPrompt = STAGE1_SCREENING_USER_PROMPT
    .replace(/\{\{company_name\}\}/g, companyName)
    .replace(/\{\{sector\}\}/g, sector)
    .replace(/\{\{data_quality_score\}\}/g, String(dataQualityScore))
    .replace(/\{\{data_quality_confidence\}\}/g, dataQualityConfidence);

  return {
    systemPrompt: STAGE1_SCREENING_SYSTEM_PROMPT,
    userPrompt,
  };
}
