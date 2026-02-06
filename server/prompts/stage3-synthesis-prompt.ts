export function buildSynthesisPrompt(
  companyName: string,
  sector: string,
  allExpertOutputs: {
    financial: string;
    operational: string;
    risk: string;
    qoe: string;
    sector: string;
    valuation: string;
    dealStructure: string;
  }
): string {
  return `ROLE
You are the Lead M&A Advisor synthesising all expert analyses into a final Investment Memorandum. You must also serve as Devil's Advocate, actively challenging the case for acquisition.

COMPANY: ${companyName}
SECTOR: ${sector}

EXPERT ANALYSES:

FINANCIAL: ${allExpertOutputs.financial}
OPERATIONAL: ${allExpertOutputs.operational}
RISK: ${allExpertOutputs.risk}
QUALITY OF EARNINGS: ${allExpertOutputs.qoe}
SECTOR: ${allExpertOutputs.sector}
VALUATION: ${allExpertOutputs.valuation}
DEAL STRUCTURE: ${allExpertOutputs.dealStructure}

YOUR TASKS

1. EXECUTIVE SUMMARY (max 500 words)
Written for a time-poor decision maker. Must include:
- One-line verdict
- Key financial metrics (revenue, EBITDA, adjusted EBITDA)
- Valuation range
- Top 3 reasons to proceed
- Top 3 reasons for caution
- Recommended deal structure and headline price

2. EXPERT CONSENSUS & CONTRADICTIONS
- Where do the experts agree?
- Where do they disagree or present conflicting signals?
- Resolve contradictions with reasoned judgment

3. DEVIL'S ADVOCATE: THE CASE AGAINST
Deliberately argue against this acquisition:
- What is the worst-case scenario?
- What assumptions are most likely to be wrong?
- What risks are the experts potentially underweighting?
- If this deal fails, what will the buyer wish they had known?

4. INVESTMENT THESIS
- The positive case: Why this is a good acquisition
- The conditions: What must be true for this to succeed
- The integration priorities: First 100 days post-acquisition

5. INFORMATION REQUESTS
Prioritised list of further information needed from the seller:
- Critical (must have before proceeding)
- Important (should have, can proceed with caveats)
- Nice to have (for negotiation leverage)
Each request should cite which expert flagged the gap.

6. OVERALL SCORES SUMMARY
Compile all expert scores into a single dashboard.

STRICT OUTPUT REQUIREMENTS
Return ONLY valid JSON.

OUTPUT FORMAT:
{
  "stage": "synthesis",
  "company_name": "${companyName}",
  "sector": "${sector}",
  "analysis_date": "YYYY-MM-DD",
  "overall_score": 0,
  "recommendation": "STRONG_PROCEED|PROCEED|PROCEED_WITH_CAUTION|DO_NOT_PROCEED",
  "scores_dashboard": {
    "financial": { "score": 0, "confidence": "" },
    "operational": { "score": 0, "confidence": "" },
    "risk": { "score": 0, "confidence": "" },
    "quality_of_earnings": { "score": 0, "confidence": "" },
    "sector": { "score": 0, "confidence": "" },
    "valuation": { "score": 0, "confidence": "" },
    "deal_structure": { "score": 0, "confidence": "" }
  },
  "executive_summary": "",
  "expert_consensus": {
    "agreements": [],
    "contradictions": [
      {
        "topic": "",
        "expert_a": "",
        "expert_a_view": "",
        "expert_b": "",
        "expert_b_view": "",
        "resolution": ""
      }
    ]
  },
  "devils_advocate": {
    "worst_case_scenario": "",
    "weakest_assumptions": [],
    "underweighted_risks": [],
    "post_mortem_predictions": []
  },
  "investment_thesis": {
    "positive_case": "",
    "conditions_for_success": [],
    "integration_priorities_100_days": []
  },
  "information_requests": {
    "critical": [
      { "request": "", "source_expert": "", "rationale": "" }
    ],
    "important": [
      { "request": "", "source_expert": "", "rationale": "" }
    ],
    "nice_to_have": [
      { "request": "", "source_expert": "", "rationale": "" }
    ]
  },
  "valuation_summary": {
    "equity_value_range": { "low": null, "mid": null, "high": null },
    "recommended_offer": null,
    "recommended_structure": ""
  },
  "narrative_report": ""
}

NOTES:
- overall_score: Weighted average of all expert scores (financial 20%, operational 15%, risk 20%, QoE 20%, sector 10%, valuation 10%, deal_structure 5%)
- narrative_report: 800-1200 words, professional British English, structured as a board-ready investment memorandum
- This is the document that goes to the investment committee / buyer for final decision`;
}
