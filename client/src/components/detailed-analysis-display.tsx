import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Zap, Users, Building2, BarChart3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DetailedAnalysisData {
  deal_snapshot?: any;
  sector_analysis?: any;
  growth_analysis?: any;
  valuation_analysis?: any;
  deal_structure?: any;
  acquisition_summary?: any;
}

interface RiskScore {
  [key: string]: 'green' | 'amber' | 'amber_red' | 'red';
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US').format(num);
};

const getRiskColor = (risk: string) => {
  const riskLower = risk?.toLowerCase() || '';
  if (riskLower.includes('red')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  if (riskLower.includes('amber')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
  if (riskLower.includes('green')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
};

const formatLabel = (text: string) => {
  return text
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const renderRiskScore = (riskKey: string, riskValue: string) => {
  const displayLabel = formatLabel(riskKey);

  return (
    <div key={riskKey} className="flex items-center justify-between p-3 rounded-lg border">
      <span className="font-medium text-sm">{displayLabel}</span>
      <Badge className={getRiskColor(riskValue)}>
        {formatLabel(riskValue)}
      </Badge>
    </div>
  );
};

export function DetailedAnalysisDisplay({ data }: { data: DetailedAnalysisData }) {
  const dealSnapshot = data.deal_snapshot;
  const sectorAnalysis = data.sector_analysis;
  const growthAnalysis = data.growth_analysis;

  if (!dealSnapshot && !sectorAnalysis && !growthAnalysis) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No detailed analysis available</p>
        <p className="text-sm">Comprehensive analysis will appear here when available</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="deal-snapshot" className="w-full">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="deal-snapshot" className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Deal Snapshot
        </TabsTrigger>
        <TabsTrigger value="sector-analysis" className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Sector Analysis
        </TabsTrigger>
        <TabsTrigger value="growth-analysis" className="flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Growth Analysis
        </TabsTrigger>
        <TabsTrigger value="valuation" className="flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Valuation
        </TabsTrigger>
        <TabsTrigger value="deal-structure" className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Deal Structure
        </TabsTrigger>
        <TabsTrigger value="acquisition" className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Acquisition Summary
        </TabsTrigger>
      </TabsList>

      {/* Deal Snapshot Tab */}
      <TabsContent value="deal-snapshot" className="space-y-6">
        {dealSnapshot && (
          <div className="space-y-6">
            {/* Meta Information */}
            {dealSnapshot.meta && (
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                  <CardTitle>Company Overview</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Company</p>
                      <p className="font-semibold">{dealSnapshot.meta.company_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Industry</p>
                      <p className="font-semibold">{dealSnapshot.meta.industry}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Latest Year</p>
                      <p className="font-semibold">{dealSnapshot.meta.latest_year}</p>
                    </div>
                  </div>
                  {dealSnapshot.meta.data_quality && (
                    <div className="mt-6 pt-6 border-t">
                      <p className="text-sm font-medium mb-3">Data Quality Scores</p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {Object.entries(dealSnapshot.meta.data_quality).map(([key, value]: [string, any]) => (
                          <div key={key} className="text-center p-2 rounded-lg bg-muted">
                            <p className="text-xs text-muted-foreground capitalize">{key}</p>
                            <p className="text-lg font-bold">{value}%</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {dealSnapshot.meta.key_limitations && dealSnapshot.meta.key_limitations.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <p className="text-sm font-medium mb-3 text-orange-700 dark:text-orange-400">Key Limitations</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {dealSnapshot.meta.key_limitations.map((limitation: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{formatLabel(limitation)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Size Profile */}
            {dealSnapshot.size_profile && (
              <Card className="border-2 border-green-200 dark:border-green-800">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Size Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Latest Revenue</p>
                      <p className="font-semibold">{formatCurrency(dealSnapshot.size_profile.revenue_latest)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Profit</p>
                      <p className="font-semibold">{formatCurrency(dealSnapshot.size_profile.net_profit_latest)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Gross Margin</p>
                      <p className="font-semibold">{dealSnapshot.size_profile.gross_margin_pct?.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Margin</p>
                      <p className="font-semibold">{dealSnapshot.size_profile.net_margin_pct?.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Assets</p>
                      <p className="font-semibold">{formatCurrency(dealSnapshot.size_profile.total_assets)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Staff Count</p>
                      <p className="font-semibold">{dealSnapshot.size_profile.staff_count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cashflow & Liquidity */}
            {dealSnapshot.cashflow_liquidity && (
              <Card className="border-2 border-cyan-200 dark:border-cyan-800">
                <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/20">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Cashflow & Liquidity
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Cash at Bank</p>
                      <p className="font-semibold">{formatCurrency(dealSnapshot.cashflow_liquidity.cash_at_bank)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Working Capital</p>
                      <p className="font-semibold">{formatCurrency(dealSnapshot.cashflow_liquidity.working_capital)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Ratio</p>
                      <p className="font-semibold">{dealSnapshot.cashflow_liquidity.current_ratio?.toFixed(2)}x</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interest Coverage</p>
                      <p className="font-semibold">{dealSnapshot.cashflow_liquidity.interest_coverage?.toFixed(1)}x</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Leverage & Balance Sheet */}
            {dealSnapshot.leverage_balance_sheet && (
              <Card className="border-2 border-purple-200 dark:border-purple-800">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
                  <CardTitle>Leverage & Balance Sheet</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Debt to Equity</p>
                      <p className="font-semibold">{dealSnapshot.leverage_balance_sheet.debt_to_equity?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Debt Ratio</p>
                      <p className="font-semibold">{(dealSnapshot.leverage_balance_sheet.debt_ratio * 100)?.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Assets</p>
                      <p className="font-semibold">{formatCurrency(dealSnapshot.leverage_balance_sheet.net_assets)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Asset Profile */}
            {dealSnapshot.asset_profile && (
              <Card className="border-2 border-indigo-200 dark:border-indigo-800">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
                  <CardTitle>Asset Profile</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Fixed Asset Turnover</p>
                      <p className="font-semibold">{dealSnapshot.asset_profile.fixed_asset_turnover?.toFixed(2)}x</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Asset Turnover</p>
                      <p className="font-semibold">{dealSnapshot.asset_profile.total_asset_turnover?.toFixed(2)}x</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Working Capital Turnover</p>
                      <p className="font-semibold">{dealSnapshot.asset_profile.working_capital_turnover?.toFixed(2)}x</p>
                    </div>
                  </div>
                  {dealSnapshot.asset_profile.notable_asset_issues && dealSnapshot.asset_profile.notable_asset_issues.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Notable Issues</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {dealSnapshot.asset_profile.notable_asset_issues.map((issue: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Customer Profile */}
            {dealSnapshot.customer_profile && (
              <Card className="border-2 border-orange-200 dark:border-orange-800">
                <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                  <CardTitle>Customer Profile</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Concentration Risk</p>
                      <Badge className={`mt-2 ${getRiskColor(dealSnapshot.customer_profile.customer_concentration_risk)}`}>
                        {dealSnapshot.customer_profile.customer_concentration_risk?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    {dealSnapshot.customer_profile.top_customer_name_examples && (
                      <div>
                        <p className="text-sm font-medium mb-2">Top Customers</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {dealSnapshot.customer_profile.top_customer_name_examples.map((customer: string, idx: number) => (
                            <li key={idx} className="text-sm">{customer}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {dealSnapshot.customer_profile.top_customer_unpaid_exposure_notes && dealSnapshot.customer_profile.top_customer_unpaid_exposure_notes.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 text-red-700 dark:text-red-400">Unpaid Exposure</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {dealSnapshot.customer_profile.top_customer_unpaid_exposure_notes.map((note: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Workforce Profile */}
            {dealSnapshot.workforce_profile && (
              <Card className="border-2 border-teal-200 dark:border-teal-800">
                <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Workforce Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Employees</p>
                      <p className="font-semibold">{dealSnapshot.workforce_profile.total_employees}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Full-time</p>
                      <p className="font-semibold">{dealSnapshot.workforce_profile.full_time}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Part-time</p>
                      <p className="font-semibold">{dealSnapshot.workforce_profile.part_time}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Payroll % of Revenue</p>
                      <p className="font-semibold">{dealSnapshot.workforce_profile.payroll_pct_of_revenue?.toFixed(1)}%</p>
                    </div>
                  </div>
                  {dealSnapshot.workforce_profile.tenured_staff_examples && dealSnapshot.workforce_profile.tenured_staff_examples.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-3">Key Staff</p>
                      <div className="space-y-2">
                        {dealSnapshot.workforce_profile.tenured_staff_examples.map((staff: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-muted">
                            <span className="text-sm font-medium">{staff.name}</span>
                            <span className="text-xs text-muted-foreground">{staff.years_of_service.toFixed(1)} yrs</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Legal Compliance */}
            {dealSnapshot.legal_compliance_profile && (
              <Card className="border-2 border-red-200 dark:border-red-800">
                <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Legal Compliance
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Overall Risk Score</p>
                      <p className="text-2xl font-bold">{dealSnapshot.legal_compliance_profile.overall_legal_risk_score}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg border">
                        <p className="text-xs text-muted-foreground">Employment Compliance</p>
                        <p className="text-lg font-semibold">{dealSnapshot.legal_compliance_profile.employment_compliance_score}</p>
                      </div>
                      <div className="p-3 rounded-lg border">
                        <p className="text-xs text-muted-foreground">Regulatory Compliance</p>
                        <p className="text-lg font-semibold">{dealSnapshot.legal_compliance_profile.regulatory_compliance_score}</p>
                      </div>
                    </div>
                    {dealSnapshot.legal_compliance_profile.key_high_priority_risks && dealSnapshot.legal_compliance_profile.key_high_priority_risks.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 text-red-700 dark:text-red-400">High Priority Risks</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {dealSnapshot.legal_compliance_profile.key_high_priority_risks.map((risk: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{risk}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {dealSnapshot.legal_compliance_profile.critical_document_gaps && dealSnapshot.legal_compliance_profile.critical_document_gaps.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Critical Document Gaps</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {dealSnapshot.legal_compliance_profile.critical_document_gaps.map((doc: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{doc}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Risk Scores */}
            {dealSnapshot.simple_risk_scores && (
              <Card className="border-2 border-yellow-200 dark:border-yellow-800">
                <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20">
                  <CardTitle>Risk Scores</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {Object.entries(dealSnapshot.simple_risk_scores).map(([key, value]) =>
                      renderRiskScore(key, value as string)
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Headline Strengths */}
            {dealSnapshot.headline_strengths && dealSnapshot.headline_strengths.length > 0 && (
              <Card className="border-2 border-green-200 dark:border-green-800">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Headline Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {dealSnapshot.headline_strengths.map((strength: string, idx: number) => (
                      <li key={idx} className="text-sm">{strength}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Headline Risks */}
            {dealSnapshot.headline_risks && dealSnapshot.headline_risks.length > 0 && (
              <Card className="border-2 border-red-200 dark:border-red-800">
                <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Headline Risks
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {dealSnapshot.headline_risks.map((risk: string, idx: number) => (
                      <li key={idx} className="text-sm">{risk}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Opportunities */}
            {dealSnapshot.opportunities && dealSnapshot.opportunities.length > 0 && (
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {dealSnapshot.opportunities.map((opportunity: string, idx: number) => (
                      <li key={idx} className="text-sm">{opportunity}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </TabsContent>

      {/* Sector Analysis Tab */}
      <TabsContent value="sector-analysis" className="space-y-6">
        {sectorAnalysis && (
          <div className="space-y-6">
            {/* Sector Overview */}
            <Card className="border-2 border-indigo-200 dark:border-indigo-800">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
                <CardTitle>Sector Overview</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Sector</p>
                    <p className="font-semibold">{sectorAnalysis.sector}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sub-sector</p>
                    <p className="font-semibold">{sectorAnalysis.sub_sector}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Market Size (2024)</p>
                    <p className="font-semibold">£{formatNumber(sectorAnalysis.market_size_uk_2024)}m</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Growth CAGR</p>
                    <p className="font-semibold">{sectorAnalysis.market_growth_cagr_pct}%</p>
                  </div>
                </div>
                {sectorAnalysis.sector_attractiveness && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Sector Attractiveness</p>
                    <Badge className={getRiskColor(sectorAnalysis.sector_attractiveness)}>
                      {sectorAnalysis.sector_attractiveness}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Market Position */}
            {sectorAnalysis.market_position_summary && (
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <CardTitle>Market Position Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {sectorAnalysis.market_position_summary}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Competitive Summary */}
            {sectorAnalysis.competitive_summary && (
              <Card className="border-2 border-orange-200 dark:border-orange-800">
                <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                  <CardTitle>Competitive Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {sectorAnalysis.competitive_summary}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sector Benchmarks */}
            {sectorAnalysis.sector_benchmarks && (
              <Card className="border-2 border-teal-200 dark:border-teal-800">
                <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20">
                  <CardTitle>Sector Benchmarks</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {Object.entries(sectorAnalysis.sector_benchmarks).map(([key, value]: [string, any]) => (
                      <Collapsible key={key} className="border rounded-lg">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                            <span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                            <ChevronDown className="w-4 h-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="p-4 border-t">
                          <p className="text-sm text-muted-foreground">{value}</p>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Opportunities */}
            {sectorAnalysis.key_opportunities && sectorAnalysis.key_opportunities.length > 0 && (
              <Card className="border-2 border-green-200 dark:border-green-800">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <CardTitle>Key Opportunities</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {sectorAnalysis.key_opportunities.map((opp: string, idx: number) => (
                      <li key={idx} className="text-sm">{opp}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Key Threats */}
            {sectorAnalysis.key_threats && sectorAnalysis.key_threats.length > 0 && (
              <Card className="border-2 border-red-200 dark:border-red-800">
                <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20">
                  <CardTitle>Key Threats</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {sectorAnalysis.key_threats.map((threat: string, idx: number) => (
                      <li key={idx} className="text-sm">{threat}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Strategic Recommendations */}
            {sectorAnalysis.strategic_recommendations && sectorAnalysis.strategic_recommendations.length > 0 && (
              <Card className="border-2 border-purple-200 dark:border-purple-800">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
                  <CardTitle>Strategic Recommendations</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {sectorAnalysis.strategic_recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="text-sm">{rec}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </TabsContent>

      {/* Growth Analysis Tab */}
      <TabsContent value="growth-analysis" className="space-y-6">
        {growthAnalysis && (
          <div className="space-y-6">
            {/* Growth Readiness */}
            <Card className="border-2 border-emerald-200 dark:border-emerald-800">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Growth Readiness
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Status</p>
                    <Badge className={getRiskColor(growthAnalysis.growth_readiness)}>
                      {growthAnalysis.growth_readiness}
                    </Badge>
                  </div>
                  {growthAnalysis.growth_readiness_explanation && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Explanation</p>
                      <p className="text-sm text-muted-foreground">{growthAnalysis.growth_readiness_explanation}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Growth Drivers */}
            {growthAnalysis.growth_drivers && growthAnalysis.growth_drivers.length > 0 && (
              <Card className="border-2 border-green-200 dark:border-green-800">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <CardTitle>Growth Drivers</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {growthAnalysis.growth_drivers.map((driver: string, idx: number) => (
                      <li key={idx} className="text-sm">{driver}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Growth Constraints */}
            {growthAnalysis.growth_constraints && growthAnalysis.growth_constraints.length > 0 && (
              <Card className="border-2 border-red-200 dark:border-red-800">
                <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20">
                  <CardTitle>Growth Constraints</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {growthAnalysis.growth_constraints.map((constraint: string, idx: number) => (
                      <li key={idx} className="text-sm">{constraint}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Priority Growth Moves */}
            {growthAnalysis.priority_growth_moves_12_24_months && growthAnalysis.priority_growth_moves_12_24_months.length > 0 && (
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <CardTitle>Priority Growth Moves (12-24 Months)</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {growthAnalysis.priority_growth_moves_12_24_months.map((move: string, idx: number) => (
                      <li key={idx} className="text-sm">{move}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </TabsContent>

      {/* Valuation Tab */}
      <TabsContent value="valuation" className="space-y-6">
        {data.valuation_analysis && (
          <div className="space-y-6">
            <Card className="border-2 border-amber-200 dark:border-amber-800">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Business Valuation
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Low Estimate</p>
                      <p className="text-2xl font-bold">{formatCurrency(data.valuation_analysis.ev_low)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{data.valuation_analysis.ebitda_multiple_low}x EBITDA</p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Most Likely</p>
                      <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{formatCurrency(data.valuation_analysis.ev_most_likely)}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">5.25x EBITDA</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">High Estimate</p>
                      <p className="text-2xl font-bold">{formatCurrency(data.valuation_analysis.ev_high)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{data.valuation_analysis.ebitda_multiple_high}x EBITDA</p>
                    </div>
                  </div>
                  {data.valuation_analysis.valuation_rationale && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Valuation Rationale</p>
                      <p className="text-sm text-muted-foreground">{data.valuation_analysis.valuation_rationale}</p>
                    </div>
                  )}
                  {data.valuation_analysis.positive_value_drivers && (
                    <div>
                      <p className="text-sm font-medium mb-2 text-green-700 dark:text-green-400">Positive Value Drivers</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {data.valuation_analysis.positive_value_drivers.map((driver: string, idx: number) => (
                          <li key={idx} className="text-sm">{driver}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.valuation_analysis.negative_value_drivers && (
                    <div>
                      <p className="text-sm font-medium mb-2 text-red-700 dark:text-red-400">Negative Value Drivers</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {data.valuation_analysis.negative_value_drivers.map((driver: string, idx: number) => (
                          <li key={idx} className="text-sm">{driver}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </TabsContent>

      {/* Deal Structure Tab */}
      <TabsContent value="deal-structure" className="space-y-6">
        {data.deal_structure && (
          <div className="space-y-6">
            <Card className="border-2 border-purple-200 dark:border-purple-800">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
                <CardTitle>Headline Deal Structure</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Price Target</p>
                      <p className="text-xl font-bold">{formatCurrency(data.deal_structure.headline_value.headline_price_target)}</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Upfront (65%)</p>
                      <p className="text-lg font-bold">{formatCurrency(data.deal_structure.payment_mix.upfront_cash_amount)}</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Deferred (15%)</p>
                      <p className="text-lg font-bold">{formatCurrency(data.deal_structure.payment_mix.deferred_amount)}</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Earn-out (20%)</p>
                      <p className="text-lg font-bold">{formatCurrency(data.deal_structure.payment_mix.earnout_amount)}</p>
                    </div>
                  </div>
                  {data.deal_structure.earnout_terms && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-3">Earn-out Terms</p>
                      <div className="space-y-2">
                        <p className="text-sm"><span className="font-medium">Duration:</span> {data.deal_structure.earnout_terms.duration_years} years</p>
                        {data.deal_structure.earnout_terms.metrics && data.deal_structure.earnout_terms.metrics.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Metrics:</p>
                            <ul className="list-disc pl-5 space-y-1">
                              {data.deal_structure.earnout_terms.metrics.map((metric: string, idx: number) => (
                                <li key={idx} className="text-sm">{metric}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {data.deal_structure.conditions_precedent && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Conditions Precedent</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {data.deal_structure.conditions_precedent.map((cond: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{cond}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </TabsContent>

      {/* Acquisition Summary Tab */}
      <TabsContent value="acquisition" className="space-y-6">
        {data.acquisition_summary && (
          <div className="space-y-6">
            <Card className="border-2 border-indigo-200 dark:border-indigo-800">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20">
                <CardTitle>Acquisition Investment Thesis</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {data.acquisition_summary.investment_thesis && (
                    <div>
                      <p className="text-sm font-medium mb-2">Summary</p>
                      <p className="text-sm text-muted-foreground">{data.acquisition_summary.investment_thesis.summary}</p>
                    </div>
                  )}
                  {data.acquisition_summary.investment_thesis?.key_strengths && (
                    <div>
                      <p className="text-sm font-medium mb-2 text-green-700 dark:text-green-400">Key Strengths</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {data.acquisition_summary.investment_thesis.key_strengths.map((strength: string, idx: number) => (
                          <li key={idx} className="text-sm">{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.acquisition_summary.investment_thesis?.key_risks && (
                    <div>
                      <p className="text-sm font-medium mb-2 text-red-700 dark:text-red-400">Key Risks</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {data.acquisition_summary.investment_thesis.key_risks.map((risk: string, idx: number) => (
                          <li key={idx} className="text-sm">{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.acquisition_summary.red_flags && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                      <p className="text-sm font-medium mb-2 text-red-700 dark:text-red-400">Red Flags</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {data.acquisition_summary.red_flags.map((flag: string, idx: number) => (
                          <li key={idx} className="text-sm text-red-600 dark:text-red-300">{flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.acquisition_summary.overall_recommendation && (
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-sm font-medium mb-2">Overall Recommendation</p>
                      <p className="text-sm text-amber-900 dark:text-amber-100">{data.acquisition_summary.overall_recommendation}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
