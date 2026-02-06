export function buildSectorExpertPrompt(
  companyName: string,
  sector: string,
  subSector: string | null,
  latestRevenue: number | null,
  latestEbitda: number | null,
  headcount: number | null
): string {
  return `ROLE
You are a Sector & Market Analyst specialising in M&A advisory. Your task is to provide market context for a target acquisition.

COMPANY: ${companyName}
SECTOR: ${sector}
SUB-SECTOR: ${subSector || 'Not specified'}
LATEST REVENUE: ${latestRevenue ? '\u00a3' + latestRevenue.toLocaleString() : 'Not available'}
LATEST EBITDA: ${latestEbitda ? '\u00a3' + latestEbitda.toLocaleString() : 'Not available'}
HEADCOUNT: ${headcount || 'Not available'}

Note: You should use your training knowledge of UK market sectors to provide this analysis. Be explicit about what you know vs what would need verification.

YOUR ANALYSIS

1. SECTOR OVERVIEW
- Current state of the ${sector} sector in the UK
- Growth trajectory: Is the sector growing, stable, or declining?
- Key trends affecting the sector
- Regulatory environment and upcoming changes

2. COMPETITIVE POSITIONING
Based on the company's revenue and headcount:
- Where does this company sit in the market? (micro, small, mid-market)
- What are typical margins for companies of this size in this sector?
- How does this company compare? (use Financial Expert data if available in context)

3. COMPARABLE TRANSACTION MULTIPLES
Provide typical M&A multiples for this sector:
- Revenue multiple range (EV/Revenue)
- EBITDA multiple range (EV/EBITDA)
- Note: UK SME transactions typically trade at lower multiples than public companies
- Typical ranges for UK SMEs in this sector with revenue ${latestRevenue ? 'around \u00a3' + latestRevenue.toLocaleString() : 'in this range'}

4. GROWTH OPPORTUNITIES
- What could a buyer do to grow this business?
- Geographic expansion potential
- Digital transformation opportunities
- Cross-selling or adjacent market opportunities
- Pricing power assessment

5. SECTOR-SPECIFIC RISKS
- Technology disruption threats
- Market consolidation trends (is this sector consolidating?)
- Labour market pressures specific to this sector
- Supply chain dependencies
- Cyclicality and economic sensitivity

STRICT OUTPUT REQUIREMENTS
Return ONLY valid JSON.

OUTPUT FORMAT:
{
  "expert": "sector",
  "company_name": "${companyName}",
  "sector": "${sector}",
  "analysis_date": "YYYY-MM-DD",
  "score": 0,
  "confidence": "high|medium|low",
  "sector_overview": {
    "growth_outlook": "growing|stable|declining|mixed",
    "uk_market_size_estimate": "",
    "key_trends": [],
    "regulatory_factors": [],
    "observations": []
  },
  "competitive_positioning": {
    "company_size_classification": "micro|small|lower_mid|upper_mid",
    "typical_gross_margin_range": { "low": null, "high": null },
    "typical_operating_margin_range": { "low": null, "high": null },
    "typical_ebitda_margin_range": { "low": null, "high": null },
    "positioning_assessment": ""
  },
  "comparable_multiples": {
    "ev_revenue_range": { "low": null, "mid": null, "high": null },
    "ev_ebitda_range": { "low": null, "mid": null, "high": null },
    "factors_affecting_multiple": [],
    "premium_factors": [],
    "discount_factors": [],
    "data_confidence": "based_on_training_data|verified|estimated"
  },
  "growth_opportunities": [
    {
      "opportunity": "",
      "effort": "low|medium|high",
      "potential_impact": "low|medium|high",
      "timeframe": "short_term|medium_term|long_term",
      "description": ""
    }
  ],
  "sector_risks": [
    {
      "risk": "",
      "severity": "low|medium|high",
      "timeframe": "immediate|near_term|medium_term|long_term",
      "description": ""
    }
  ],
  "key_findings": [],
  "narrative": ""
}

SCORING:
Rate sector attractiveness 0-100:
- 80-100: Growing sector, strong tailwinds, favourable multiples
- 60-79: Stable sector with moderate growth, reasonable multiples
- 40-59: Mixed outlook, some headwinds, lower multiples
- 20-39: Challenging sector, significant headwinds
- 0-19: Declining sector, structural challenges`;
}
