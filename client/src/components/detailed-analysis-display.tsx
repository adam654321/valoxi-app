import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Zap, Users, Building2, BarChart3, FileText, CreditCard, Target, Clock, Shield, Calculator } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnalysisSummary } from './detailed-analysis/AnalysisSummary';
import { ScenarioSummaryTable, RepaymentPlansCard } from './detailed-analysis/AnalysisFinancialTable';
import { DetailedAnalysisData, formatCurrency, formatNumber, formatLabel, getRiskColor } from './detailed-analysis/types';
import { useDetailedAnalysis } from '@/hooks/useDetailedAnalysis';

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
  const { dealSnapshot, sectorAnalysis, growthAnalysis, hasData } = useDetailedAnalysis(data);

  if (!hasData) {
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
      <TabsList className="grid w-full grid-cols-7">
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
        <TabsTrigger value="deal-sheet" className="flex items-center gap-2" data-testid="tab-deal-sheet">
          <FileText className="w-4 h-4" />
          Deal Sheet
        </TabsTrigger>
      </TabsList>

      {/* Deal Snapshot Tab */}
      <TabsContent value="deal-snapshot" className="space-y-6">
        {dealSnapshot && (
          <div className="space-y-6">
            {/* Company Overview and Size Profile */}
            <AnalysisSummary dealSnapshot={dealSnapshot} />

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
                            <span className="text-sm font-medium">{staff.name || 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">{staff.years_of_service != null ? staff.years_of_service.toFixed(1) : 'N/A'} yrs</span>
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

            {/* Risk Notes */}
            {sectorAnalysis.risk_notes && sectorAnalysis.risk_notes.length > 0 && (
              <Card className="border-2 border-orange-200 dark:border-orange-800">
                <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                  <CardTitle>Risk Notes</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {sectorAnalysis.risk_notes.map((note: string, idx: number) => (
                      <li key={idx} className="text-sm">{note}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Confidence */}
            {sectorAnalysis.confidence && (
              <Card className="border-2 border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20">
                  <CardTitle>Confidence Assessment</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Overall Confidence</p>
                      <Badge className={getRiskColor(sectorAnalysis.confidence.overall_confidence)}>
                        {sectorAnalysis.confidence.overall_confidence}
                      </Badge>
                    </div>
                    {sectorAnalysis.confidence.data_limitations && sectorAnalysis.confidence.data_limitations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Data Limitations</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {sectorAnalysis.confidence.data_limitations.map((limitation: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{limitation}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
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

            {/* KPI Focus */}
            {growthAnalysis.kpi_focus && growthAnalysis.kpi_focus.length > 0 && (
              <Card className="border-2 border-purple-200 dark:border-purple-800">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
                  <CardTitle>KPI Focus Areas</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {growthAnalysis.kpi_focus.map((kpi: string, idx: number) => (
                      <li key={idx} className="text-sm">{kpi}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Required Capabilities */}
            {growthAnalysis.required_capabilities && growthAnalysis.required_capabilities.length > 0 && (
              <Card className="border-2 border-indigo-200 dark:border-indigo-800">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
                  <CardTitle>Required Capabilities</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {growthAnalysis.required_capabilities.map((cap: string, idx: number) => (
                      <li key={idx} className="text-sm">{cap}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Confidence */}
            {growthAnalysis.confidence && (
              <Card className="border-2 border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20">
                  <CardTitle>Confidence Assessment</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Overall Confidence</p>
                      <Badge className={getRiskColor(growthAnalysis.confidence.overall_confidence)}>
                        {growthAnalysis.confidence.overall_confidence}
                      </Badge>
                    </div>
                    {growthAnalysis.confidence.data_limitations && growthAnalysis.confidence.data_limitations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Data Limitations</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {growthAnalysis.confidence.data_limitations.map((limitation: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{limitation}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
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

            {/* Risk Adjustments */}
            {data.valuation_analysis.risk_adjustments && (
              <Card className="border-2 border-orange-200 dark:border-orange-800">
                <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                  <CardTitle>Risk Adjustments (Discounts)</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(data.valuation_analysis.risk_adjustments).map(([key, value]: [string, any]) => (
                      <div key={key} className="p-3 rounded-lg border">
                        <p className="text-xs text-muted-foreground">{formatLabel(key.replace('_pct', ''))}</p>
                        <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{value}%</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sensitivity Analysis */}
            {data.valuation_analysis.sensitivity_analysis && data.valuation_analysis.sensitivity_analysis.length > 0 && (
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <CardTitle>Sensitivity Analysis</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {data.valuation_analysis.sensitivity_analysis.map((item: string, idx: number) => (
                      <li key={idx} className="text-sm">{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Investment View */}
            {data.valuation_analysis.investment_view && (
              <Card className="border-2 border-green-200 dark:border-green-800">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <CardTitle>Investment View</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-sm">{data.valuation_analysis.investment_view}</p>
                </CardContent>
              </Card>
            )}

            {/* Confidence */}
            {data.valuation_analysis.confidence && (
              <Card className="border-2 border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20">
                  <CardTitle>Confidence Assessment</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Overall Confidence</p>
                      <Badge className={getRiskColor(data.valuation_analysis.confidence.overall_confidence)}>
                        {data.valuation_analysis.confidence.overall_confidence}
                      </Badge>
                    </div>
                    {data.valuation_analysis.confidence.limitations && data.valuation_analysis.confidence.limitations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Limitations</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.valuation_analysis.confidence.limitations.map((limitation: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{limitation}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
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
                      <p className="text-xl font-bold">{formatCurrency(data.deal_structure.headline_value?.headline_price_target)}</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Upfront ({data.deal_structure.payment_mix?.upfront_cash_pct}%)</p>
                      <p className="text-lg font-bold">{formatCurrency(data.deal_structure.payment_mix?.upfront_cash_amount)}</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Deferred ({data.deal_structure.payment_mix?.deferred_pct}%)</p>
                      <p className="text-lg font-bold">{formatCurrency(data.deal_structure.payment_mix?.deferred_amount)}</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Earn-out ({data.deal_structure.payment_mix?.earnout_pct}%)</p>
                      <p className="text-lg font-bold">{formatCurrency(data.deal_structure.payment_mix?.earnout_amount)}</p>
                    </div>
                  </div>
                  {data.deal_structure.headline_value?.headline_rationale && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Headline Rationale</p>
                      <p className="text-sm text-muted-foreground">{data.deal_structure.headline_value.headline_rationale}</p>
                    </div>
                  )}
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
                        {data.deal_structure.earnout_terms.metric_rationale && (
                          <div className="mt-2">
                            <p className="text-sm font-medium mb-1">Metric Rationale:</p>
                            <p className="text-sm text-muted-foreground">{data.deal_structure.earnout_terms.metric_rationale}</p>
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

            {/* Protections */}
            {data.deal_structure.protections && (
              <Card className="border-2 border-red-200 dark:border-red-800">
                <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20">
                  <CardTitle>Deal Protections</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {data.deal_structure.protections.warranty_focus_areas && data.deal_structure.protections.warranty_focus_areas.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Warranty Focus Areas</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.deal_structure.protections.warranty_focus_areas.map((area: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{area}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.deal_structure.protections.indemnity_focus_areas && data.deal_structure.protections.indemnity_focus_areas.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Indemnity Focus Areas</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.deal_structure.protections.indemnity_focus_areas.map((area: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{area}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.deal_structure.protections.escrow_or_holdback_recommendations && data.deal_structure.protections.escrow_or_holdback_recommendations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Escrow/Holdback Recommendations</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.deal_structure.protections.escrow_or_holdback_recommendations.map((rec: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Post Completion Priorities */}
            {data.deal_structure.post_completion_priorities && data.deal_structure.post_completion_priorities.length > 0 && (
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <CardTitle>Post-Completion Priorities</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {data.deal_structure.post_completion_priorities.map((priority: string, idx: number) => (
                      <li key={idx} className="text-sm">{priority}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Deal Structure Rationale */}
            {data.deal_structure.deal_structure_rationale && (
              <Card className="border-2 border-indigo-200 dark:border-indigo-800">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
                  <CardTitle>Deal Structure Rationale</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-sm">{data.deal_structure.deal_structure_rationale}</p>
                </CardContent>
              </Card>
            )}

            {/* Confidence */}
            {data.deal_structure.confidence && (
              <Card className="border-2 border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20">
                  <CardTitle>Confidence Assessment</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Overall Confidence</p>
                      <Badge className={getRiskColor(data.deal_structure.confidence.overall_confidence)}>
                        {data.deal_structure.confidence.overall_confidence}
                      </Badge>
                    </div>
                    {data.deal_structure.confidence.limitations && data.deal_structure.confidence.limitations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Limitations</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.deal_structure.confidence.limitations.map((limitation: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{limitation}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </TabsContent>

      {/* Acquisition Summary Tab */}
      <TabsContent value="acquisition" className="space-y-6">
        {data.acquisition_summary && (
          <div className="space-y-6">
            {/* Deal Overview */}
            {data.acquisition_summary.deal_overview && (
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                  <CardTitle>Deal Overview</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Company</p>
                      <p className="font-semibold">{data.acquisition_summary.deal_overview.company_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Industry</p>
                      <p className="font-semibold">{data.acquisition_summary.deal_overview.industry}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sub-sector</p>
                      <p className="font-semibold">{data.acquisition_summary.deal_overview.sub_sector}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Size Classification</p>
                      <p className="font-semibold capitalize">{data.acquisition_summary.deal_overview.size_classification}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Revenue</p>
                      <p className="font-semibold">{formatCurrency(data.acquisition_summary.deal_overview.headline_revenue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Profit</p>
                      <p className="font-semibold">{formatCurrency(data.acquisition_summary.deal_overview.headline_net_profit)}</p>
                    </div>
                  </div>
                  {data.acquisition_summary.deal_overview.business_description && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Business Description</p>
                      <p className="text-sm text-muted-foreground">{data.acquisition_summary.deal_overview.business_description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Investment Thesis */}
            <Card className="border-2 border-indigo-200 dark:border-indigo-800">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20">
                <CardTitle>Investment Thesis</CardTitle>
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
                  {data.acquisition_summary.investment_thesis?.key_mitigants && (
                    <div>
                      <p className="text-sm font-medium mb-2 text-blue-700 dark:text-blue-400">Key Mitigants</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {data.acquisition_summary.investment_thesis.key_mitigants.map((mitigant: string, idx: number) => (
                          <li key={idx} className="text-sm">{mitigant}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Financial Snapshot */}
            {data.acquisition_summary.financial_snapshot && (
              <Card className="border-2 border-green-200 dark:border-green-800">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <CardTitle>Financial Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Revenue</p>
                      <p className="font-semibold">{formatCurrency(data.acquisition_summary.financial_snapshot.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Profit</p>
                      <p className="font-semibold">{formatCurrency(data.acquisition_summary.financial_snapshot.net_profit)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Gross Margin</p>
                      <p className="font-semibold">{data.acquisition_summary.financial_snapshot.gross_margin_pct}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Margin</p>
                      <p className="font-semibold">{data.acquisition_summary.financial_snapshot.net_margin_pct}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cash at Bank</p>
                      <p className="font-semibold">{formatCurrency(data.acquisition_summary.financial_snapshot.cash_at_bank)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Ratio</p>
                      <p className="font-semibold">{data.acquisition_summary.financial_snapshot.current_ratio}x</p>
                    </div>
                  </div>
                  {data.acquisition_summary.financial_snapshot.customer_concentration_comment && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Customer Concentration</p>
                      <p className="text-sm text-muted-foreground">{data.acquisition_summary.financial_snapshot.customer_concentration_comment}</p>
                    </div>
                  )}
                  {data.acquisition_summary.financial_snapshot.other_critical_financial_notes && data.acquisition_summary.financial_snapshot.other_critical_financial_notes.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Other Critical Financial Notes</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {data.acquisition_summary.financial_snapshot.other_critical_financial_notes.map((note: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sector Snapshot */}
            {data.acquisition_summary.sector_snapshot && (
              <Card className="border-2 border-purple-200 dark:border-purple-800">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
                  <CardTitle>Sector Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Sector</p>
                        <p className="font-semibold">{data.acquisition_summary.sector_snapshot.sector}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Sector Attractiveness</p>
                        <Badge className={getRiskColor(data.acquisition_summary.sector_snapshot.sector_attractiveness)}>
                          {data.acquisition_summary.sector_snapshot.sector_attractiveness}
                        </Badge>
                      </div>
                    </div>
                    {data.acquisition_summary.sector_snapshot.market_size_comment && (
                      <div>
                        <p className="text-sm font-medium mb-1">Market Size</p>
                        <p className="text-sm text-muted-foreground">{data.acquisition_summary.sector_snapshot.market_size_comment}</p>
                      </div>
                    )}
                    {data.acquisition_summary.sector_snapshot.growth_trend_comment && (
                      <div>
                        <p className="text-sm font-medium mb-1">Growth Trend</p>
                        <p className="text-sm text-muted-foreground">{data.acquisition_summary.sector_snapshot.growth_trend_comment}</p>
                      </div>
                    )}
                    {data.acquisition_summary.sector_snapshot.competitive_position_comment && (
                      <div>
                        <p className="text-sm font-medium mb-1">Competitive Position</p>
                        <p className="text-sm text-muted-foreground">{data.acquisition_summary.sector_snapshot.competitive_position_comment}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Growth Summary */}
            {data.acquisition_summary.growth_summary && (
              <Card className="border-2 border-emerald-200 dark:border-emerald-800">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
                  <CardTitle>Growth Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Growth Readiness</p>
                      <Badge className={getRiskColor(data.acquisition_summary.growth_summary.growth_readiness)}>
                        {data.acquisition_summary.growth_summary.growth_readiness}
                      </Badge>
                    </div>
                    {data.acquisition_summary.growth_summary.main_growth_drivers && (
                      <div>
                        <p className="text-sm font-medium mb-2 text-green-700 dark:text-green-400">Main Growth Drivers</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.acquisition_summary.growth_summary.main_growth_drivers.map((driver: string, idx: number) => (
                            <li key={idx} className="text-sm">{driver}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.acquisition_summary.growth_summary.main_growth_constraints && (
                      <div>
                        <p className="text-sm font-medium mb-2 text-red-700 dark:text-red-400">Main Growth Constraints</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.acquisition_summary.growth_summary.main_growth_constraints.map((constraint: string, idx: number) => (
                            <li key={idx} className="text-sm">{constraint}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.acquisition_summary.growth_summary.priority_growth_moves_12_24_months && (
                      <div>
                        <p className="text-sm font-medium mb-2">Priority Growth Moves (12-24 Months)</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.acquisition_summary.growth_summary.priority_growth_moves_12_24_months.map((move: string, idx: number) => (
                            <li key={idx} className="text-sm">{move}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.acquisition_summary.growth_summary.kpi_focus && (
                      <div>
                        <p className="text-sm font-medium mb-2">KPI Focus</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.acquisition_summary.growth_summary.kpi_focus.map((kpi: string, idx: number) => (
                            <li key={idx} className="text-sm">{kpi}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Valuation Summary */}
            {data.acquisition_summary.valuation_summary && (
              <Card className="border-2 border-amber-200 dark:border-amber-800">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
                  <CardTitle>Valuation Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground">Low</p>
                        <p className="text-lg font-bold">{formatCurrency(data.acquisition_summary.valuation_summary.ev_low)}</p>
                        <p className="text-xs text-muted-foreground">{data.acquisition_summary.valuation_summary.ebitda_multiple_low}x</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Most Likely</p>
                        <p className="text-lg font-bold text-amber-900 dark:text-amber-100">{formatCurrency(data.acquisition_summary.valuation_summary.ev_most_likely)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground">High</p>
                        <p className="text-lg font-bold">{formatCurrency(data.acquisition_summary.valuation_summary.ev_high)}</p>
                        <p className="text-xs text-muted-foreground">{data.acquisition_summary.valuation_summary.ebitda_multiple_high}x</p>
                      </div>
                    </div>
                    {data.acquisition_summary.valuation_summary.valuation_rationale && (
                      <div>
                        <p className="text-sm font-medium mb-2">Valuation Rationale</p>
                        <p className="text-sm text-muted-foreground">{data.acquisition_summary.valuation_summary.valuation_rationale}</p>
                      </div>
                    )}
                    {data.acquisition_summary.valuation_summary.positive_value_drivers && (
                      <div>
                        <p className="text-sm font-medium mb-2 text-green-700 dark:text-green-400">Positive Value Drivers</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.acquisition_summary.valuation_summary.positive_value_drivers.map((driver: string, idx: number) => (
                            <li key={idx} className="text-sm">{driver}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.acquisition_summary.valuation_summary.negative_value_drivers && (
                      <div>
                        <p className="text-sm font-medium mb-2 text-red-700 dark:text-red-400">Negative Value Drivers</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.acquisition_summary.valuation_summary.negative_value_drivers.map((driver: string, idx: number) => (
                            <li key={idx} className="text-sm">{driver}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Deal Structure Summary */}
            {data.acquisition_summary.deal_structure_summary && (
              <Card className="border-2 border-purple-200 dark:border-purple-800">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
                  <CardTitle>Deal Structure Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg border">
                        <p className="text-xs text-muted-foreground">Price Target</p>
                        <p className="text-lg font-bold">{formatCurrency(data.acquisition_summary.deal_structure_summary.headline_price_target)}</p>
                      </div>
                      <div className="p-3 rounded-lg border">
                        <p className="text-xs text-muted-foreground">Upfront</p>
                        <p className="text-lg font-bold">{data.acquisition_summary.deal_structure_summary.payment_mix?.upfront_cash_pct}%</p>
                      </div>
                      <div className="p-3 rounded-lg border">
                        <p className="text-xs text-muted-foreground">Deferred</p>
                        <p className="text-lg font-bold">{data.acquisition_summary.deal_structure_summary.payment_mix?.deferred_pct}%</p>
                      </div>
                      <div className="p-3 rounded-lg border">
                        <p className="text-xs text-muted-foreground">Earn-out</p>
                        <p className="text-lg font-bold">{data.acquisition_summary.deal_structure_summary.payment_mix?.earnout_pct}%</p>
                      </div>
                    </div>
                    {data.acquisition_summary.deal_structure_summary.earnout_headline_terms && (
                      <div>
                        <p className="text-sm font-medium mb-2">Earn-out Terms</p>
                        <p className="text-sm text-muted-foreground">{data.acquisition_summary.deal_structure_summary.earnout_headline_terms}</p>
                      </div>
                    )}
                    {data.acquisition_summary.deal_structure_summary.key_conditions_precedent && (
                      <div>
                        <p className="text-sm font-medium mb-2">Key Conditions Precedent</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.acquisition_summary.deal_structure_summary.key_conditions_precedent.map((cp: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{cp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.acquisition_summary.deal_structure_summary.key_protections && (
                      <div>
                        <p className="text-sm font-medium mb-2">Key Protections</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.acquisition_summary.deal_structure_summary.key_protections.map((protection: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{protection}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Red Flags */}
            {data.acquisition_summary.red_flags && (
              <Card className="border-2 border-red-200 dark:border-red-800">
                <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Red Flags
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {data.acquisition_summary.red_flags.map((flag: string, idx: number) => (
                      <li key={idx} className="text-sm text-red-700 dark:text-red-300">{flag}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Execution Priorities */}
            {data.acquisition_summary.execution_priorities_12_24_months && data.acquisition_summary.execution_priorities_12_24_months.length > 0 && (
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <CardTitle>Execution Priorities (12-24 Months)</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc pl-5 space-y-2">
                    {data.acquisition_summary.execution_priorities_12_24_months.map((priority: string, idx: number) => (
                      <li key={idx} className="text-sm">{priority}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Overall Recommendation */}
            {data.acquisition_summary.overall_recommendation && (
              <Card className="border-2 border-amber-200 dark:border-amber-800">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
                  <CardTitle>Overall Recommendation</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-sm">{data.acquisition_summary.overall_recommendation}</p>
                </CardContent>
              </Card>
            )}

            {/* Confidence */}
            {data.acquisition_summary.confidence && (
              <Card className="border-2 border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20">
                  <CardTitle>Confidence Assessment</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Overall Confidence</p>
                      <Badge className={getRiskColor(data.acquisition_summary.confidence.overall_confidence)}>
                        {data.acquisition_summary.confidence.overall_confidence}
                      </Badge>
                    </div>
                    {data.acquisition_summary.confidence.limitations && data.acquisition_summary.confidence.limitations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Limitations</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {data.acquisition_summary.confidence.limitations.map((limitation: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{limitation}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </TabsContent>

      {/* Deal Sheet Tab */}
      <TabsContent value="deal-sheet" className="space-y-6">
        {data.deal_sheet ? (
          <div className="space-y-6" data-testid="deal-sheet-content">
            {/* Page 1: Deal Summary */}
            {data.deal_sheet.page_1 && (
              <>
                {/* Header Section */}
                {data.deal_sheet.page_1.header && (
                  <Card className="border-2 border-indigo-200 dark:border-indigo-800">
                    <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-2xl" data-testid="deal-sheet-title">
                            {data.deal_sheet.page_1.header.title}
                          </CardTitle>
                          {data.deal_sheet.page_1.header.subtitle && (
                            <CardDescription className="text-base mt-1">
                              {data.deal_sheet.page_1.header.subtitle}
                            </CardDescription>
                          )}
                        </div>
                        {data.deal_sheet.page_1.header.badges && data.deal_sheet.page_1.header.badges.length > 0 && (
                          <div className="flex gap-2">
                            {data.deal_sheet.page_1.header.badges.map((badge: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                                {badge}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {data.deal_sheet.meta && (
                        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                          {data.deal_sheet.meta.deal_status && (
                            <span>Status: <strong>{data.deal_sheet.meta.deal_status}</strong></span>
                          )}
                          {data.deal_sheet.meta.generated_date_local && (
                            <span>Generated: {data.deal_sheet.meta.generated_date_local}</span>
                          )}
                        </div>
                      )}
                    </CardHeader>
                  </Card>
                )}

                {/* At-a-Glance Metrics */}
                {data.deal_sheet.page_1.at_a_glance && (
                  <Card className="border-2 border-green-200 dark:border-green-800">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        At a Glance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {data.deal_sheet.page_1.at_a_glance.metrics && (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                          {data.deal_sheet.page_1.at_a_glance.metrics.map((metric: any, idx: number) => (
                            <div key={idx} className="text-center p-3 rounded-lg bg-muted" data-testid={`metric-${idx}`}>
                              <p className="text-xs text-muted-foreground">{metric.label}</p>
                              <p className="text-lg font-bold">{metric.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {data.deal_sheet.page_1.at_a_glance.valuation_summary && (
                        <div className="p-4 rounded-lg border-2 border-dashed border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20">
                          <div className="flex items-center gap-2 mb-3">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            <p className="font-semibold text-green-800 dark:text-green-200">Valuation Summary</p>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">EV Low</p>
                              <p className="font-semibold">{formatCurrency(data.deal_sheet.page_1.at_a_glance.valuation_summary.ev_low)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">EV High</p>
                              <p className="font-semibold">{formatCurrency(data.deal_sheet.page_1.at_a_glance.valuation_summary.ev_high)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Most Likely</p>
                              <p className="font-semibold text-green-700 dark:text-green-300">{formatCurrency(data.deal_sheet.page_1.at_a_glance.valuation_summary.ev_most_likely)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Target Price</p>
                              <p className="font-bold text-lg text-green-700 dark:text-green-300">{formatCurrency(data.deal_sheet.page_1.at_a_glance.valuation_summary.headline_price_target)}</p>
                            </div>
                          </div>
                          {data.deal_sheet.page_1.at_a_glance.valuation_summary.multiple_range && (
                            <p className="text-sm text-muted-foreground mt-2">Multiple Range: {data.deal_sheet.page_1.at_a_glance.valuation_summary.multiple_range}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Investment Thesis */}
                {data.deal_sheet.page_1.investment_thesis && (
                  <div className="grid md:grid-cols-3 gap-4">
                    {data.deal_sheet.page_1.investment_thesis.key_strengths && (
                      <Card className="border-2 border-green-200 dark:border-green-800">
                        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 pb-3">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            Key Strengths
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="list-disc pl-5 space-y-2">
                            {data.deal_sheet.page_1.investment_thesis.key_strengths.map((strength: string, idx: number) => (
                              <li key={idx} className="text-sm text-green-700 dark:text-green-300">{strength}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                    {data.deal_sheet.page_1.investment_thesis.key_risks && (
                      <Card className="border-2 border-red-200 dark:border-red-800">
                        <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 pb-3">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            Key Risks
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="list-disc pl-5 space-y-2">
                            {data.deal_sheet.page_1.investment_thesis.key_risks.map((risk: string, idx: number) => (
                              <li key={idx} className="text-sm text-red-700 dark:text-red-300">{risk}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                    {data.deal_sheet.page_1.investment_thesis.key_mitigants && (
                      <Card className="border-2 border-blue-200 dark:border-blue-800">
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 pb-3">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Shield className="w-5 h-5 text-blue-600" />
                            Key Mitigants
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="list-disc pl-5 space-y-2">
                            {data.deal_sheet.page_1.investment_thesis.key_mitigants.map((mitigant: string, idx: number) => (
                              <li key={idx} className="text-sm text-blue-700 dark:text-blue-300">{mitigant}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Deal Structure Overview */}
                {data.deal_sheet.page_1.deal_structure && (
                  <Card className="border-2 border-purple-200 dark:border-purple-800">
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Deal Structure
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      {data.deal_sheet.page_1.deal_structure.payment_mix && (
                        <div>
                          <p className="text-sm font-medium mb-3">Payment Mix</p>
                          <div className="flex gap-2 mb-4">
                            <div className="flex-1 bg-green-500 rounded-l-lg text-white text-center py-2 text-sm font-medium" style={{ flexBasis: `${data.deal_sheet.page_1.deal_structure.payment_mix.upfront_cash_pct}%` }}>
                              Upfront {data.deal_sheet.page_1.deal_structure.payment_mix.upfront_cash_pct}%
                            </div>
                            <div className="flex-1 bg-amber-500 text-white text-center py-2 text-sm font-medium" style={{ flexBasis: `${data.deal_sheet.page_1.deal_structure.payment_mix.deferred_pct}%` }}>
                              Deferred {data.deal_sheet.page_1.deal_structure.payment_mix.deferred_pct}%
                            </div>
                            <div className="flex-1 bg-blue-500 rounded-r-lg text-white text-center py-2 text-sm font-medium" style={{ flexBasis: `${data.deal_sheet.page_1.deal_structure.payment_mix.earnout_pct}%` }}>
                              Earnout {data.deal_sheet.page_1.deal_structure.payment_mix.earnout_pct}%
                            </div>
                          </div>
                        </div>
                      )}
                      {data.deal_sheet.page_1.deal_structure.earnout_terms_headline && (
                        <div>
                          <p className="text-sm font-medium mb-2">Earn-out Terms</p>
                          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{data.deal_sheet.page_1.deal_structure.earnout_terms_headline}</p>
                        </div>
                      )}
                      <div className="grid md:grid-cols-2 gap-4">
                        {data.deal_sheet.page_1.deal_structure.key_conditions_precedent && (
                          <div>
                            <p className="text-sm font-medium mb-2">Conditions Precedent</p>
                            <ul className="list-disc pl-5 space-y-1">
                              {data.deal_sheet.page_1.deal_structure.key_conditions_precedent.map((cp: string, idx: number) => (
                                <li key={idx} className="text-sm text-muted-foreground">{cp}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {data.deal_sheet.page_1.deal_structure.key_protections && (
                          <div>
                            <p className="text-sm font-medium mb-2">Key Protections</p>
                            <ul className="list-disc pl-5 space-y-1">
                              {data.deal_sheet.page_1.deal_structure.key_protections.map((protection: string, idx: number) => (
                                <li key={idx} className="text-sm text-muted-foreground">{protection}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Red Flags */}
                {data.deal_sheet.page_1.red_flags && data.deal_sheet.page_1.red_flags.length > 0 && (
                  <Card className="border-2 border-red-200 dark:border-red-800">
                    <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20">
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        Red Flags
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ul className="list-disc pl-5 space-y-2">
                        {data.deal_sheet.page_1.red_flags.map((flag: string, idx: number) => (
                          <li key={idx} className="text-sm text-red-700 dark:text-red-300">{flag}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Execution Priorities */}
                {data.deal_sheet.page_1.execution_priorities && (
                  <Card className="border-2 border-cyan-200 dark:border-cyan-800">
                    <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/20">
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        Execution Priorities
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        {data.deal_sheet.page_1.execution_priorities.de_risking && (
                          <div>
                            <p className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Shield className="w-4 h-4 text-amber-600" />
                              De-risking
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                              {data.deal_sheet.page_1.execution_priorities.de_risking.map((item: string, idx: number) => (
                                <li key={idx} className="text-sm text-muted-foreground">{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {data.deal_sheet.page_1.execution_priorities.growth_enablement && (
                          <div>
                            <p className="text-sm font-medium mb-2 flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-green-600" />
                              Growth Enablement
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                              {data.deal_sheet.page_1.execution_priorities.growth_enablement.map((item: string, idx: number) => (
                                <li key={idx} className="text-sm text-muted-foreground">{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Overall Recommendation */}
                {data.deal_sheet.page_1.overall_recommendation && (
                  <Card className="border-2 border-amber-200 dark:border-amber-800">
                    <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-amber-600" />
                        Recommendation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <p className="text-sm font-medium">{data.deal_sheet.page_1.overall_recommendation}</p>
                      {data.deal_sheet.page_1.confidence && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm text-muted-foreground">Confidence:</span>
                            <Badge className={getRiskColor(data.deal_sheet.page_1.confidence.overall_confidence)}>
                              {formatLabel(data.deal_sheet.page_1.confidence.overall_confidence)}
                            </Badge>
                          </div>
                          {data.deal_sheet.page_1.confidence.limitations && (
                            <ul className="list-disc pl-5 space-y-1">
                              {data.deal_sheet.page_1.confidence.limitations.map((limitation: string, idx: number) => (
                                <li key={idx} className="text-xs text-muted-foreground">{limitation}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Page 2: Funding & DSCR */}
            {data.deal_sheet.page_2?.funding_and_dscr && (
              <>
                {/* Funding Summary */}
                {data.deal_sheet.page_2.funding_and_dscr.funding_summary && (
                  <Card className="border-2 border-teal-200 dark:border-teal-800">
                    <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20">
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Funding Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <div className="text-center p-3 rounded-lg bg-muted">
                          <p className="text-xs text-muted-foreground">Target Price</p>
                          <p className="text-lg font-bold">{formatCurrency(data.deal_sheet.page_2.funding_and_dscr.funding_summary.headline_price_target)}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                          <p className="text-xs text-muted-foreground">Equity</p>
                          <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(data.deal_sheet.page_2.funding_and_dscr.funding_summary.equity_injection)}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <p className="text-xs text-muted-foreground">Senior Debt</p>
                          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(data.deal_sheet.page_2.funding_and_dscr.funding_summary.senior_debt)}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                          <p className="text-xs text-muted-foreground">Seller Note</p>
                          <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{formatCurrency(data.deal_sheet.page_2.funding_and_dscr.funding_summary.seller_note)}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                          <p className="text-xs text-muted-foreground">Escrow/Holdback</p>
                          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(data.deal_sheet.page_2.funding_and_dscr.funding_summary.escrow_or_holdback)}</p>
                        </div>
                      </div>
                      {data.deal_sheet.page_2.funding_and_dscr.funding_summary.notes && (
                        <div className="bg-muted p-3 rounded-lg">
                          <p className="text-xs font-medium mb-1">Notes:</p>
                          <ul className="list-disc pl-4 space-y-1">
                            {data.deal_sheet.page_2.funding_and_dscr.funding_summary.notes.map((note: string, idx: number) => (
                              <li key={idx} className="text-xs text-muted-foreground">{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* DSCR Model */}
                {data.deal_sheet.page_2.funding_and_dscr.dscr_model && (
                  <Card className="border-2 border-indigo-200 dark:border-indigo-800">
                    <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="w-5 h-5" />
                        DSCR Model
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 rounded-lg border">
                          <p className="text-xs text-muted-foreground">DSCR Target</p>
                          <p className="text-lg font-bold">{data.deal_sheet.page_2.funding_and_dscr.dscr_model.dscr_target}x</p>
                        </div>
                        <div className="p-3 rounded-lg border">
                          <p className="text-xs text-muted-foreground">CFADS Basis</p>
                          <p className="text-lg font-bold">{formatLabel(data.deal_sheet.page_2.funding_and_dscr.dscr_model.cfads_basis)}</p>
                        </div>
                        <div className="p-3 rounded-lg border">
                          <p className="text-xs text-muted-foreground">CFADS (After Haircut)</p>
                          <p className="text-lg font-bold">{formatCurrency(data.deal_sheet.page_2.funding_and_dscr.dscr_model.cfads_annual_after_haircut)}</p>
                        </div>
                        <div className="p-3 rounded-lg border">
                          <p className="text-xs text-muted-foreground">Lender Feasibility</p>
                          <Badge className={data.deal_sheet.page_2.funding_and_dscr.dscr_model.lender_feasibility === 'feasible' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800'}>
                            {formatLabel(data.deal_sheet.page_2.funding_and_dscr.dscr_model.lender_feasibility)}
                          </Badge>
                        </div>
                      </div>

                      {/* Scenario Summary Table */}
                      {data.deal_sheet.page_2.funding_and_dscr.dscr_model.scenario_summary && (
                        <ScenarioSummaryTable scenarios={data.deal_sheet.page_2.funding_and_dscr.dscr_model.scenario_summary} />
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Repayment Plan Tables */}
                {data.deal_sheet.page_2.funding_and_dscr.repayment_plan_tables && data.deal_sheet.page_2.funding_and_dscr.repayment_plan_tables.length > 0 && (
                  <RepaymentPlansCard plans={data.deal_sheet.page_2.funding_and_dscr.repayment_plan_tables} />
                )}
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No deal sheet available</p>
            <p className="text-sm">Deal sheet information will appear here when available</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
