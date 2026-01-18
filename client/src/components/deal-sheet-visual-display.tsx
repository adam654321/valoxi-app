import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, TrendingUp, AlertTriangle, CheckCircle, 
  Building2, BarChart3, FileText, CreditCard, Target, Shield, Calculator,
  PieChart as PieChartIcon, Activity, Scale
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar
} from "recharts";

interface DealSheetVisualDisplayProps {
  markdown: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    promptTokensDetails?: Array<{ modality: string; tokenCount: number }>;
    thoughtsTokenCount?: number;
  };
  processingTime?: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) {
    return `£${(value / 1000000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `£${(value / 1000).toFixed(0)}K`;
  }
  return `£${value.toFixed(0)}`;
};

const cleanMarkdown = (text: string): string => {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim();
};

const parseListItems = (text: string | undefined): string[] => {
  if (!text) return [];
  const lines = text.split('\n');
  const items: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    const bulletMatch = trimmed.match(/^[-•*+]\s+(.+)$/);
    if (bulletMatch) {
      const cleaned = cleanMarkdown(bulletMatch[1]);
      if (cleaned.length > 0) {
        items.push(cleaned);
      }
    }
  }
  
  return items;
};

export function DealSheetVisualDisplay({ markdown, usageMetadata, processingTime }: DealSheetVisualDisplayProps) {
  
  const parseFinancialPerformance = (content: string) => {
    const sectionMatch = content.match(/## 2\. FINANCIAL PERFORMANCE[\s\S]*?(?=## 3\.|$)/i);
    if (!sectionMatch) return null;
    
    const tableMatch = sectionMatch[0].match(/\|[^\n]+\|\n\|[-\s|:]+\|\n((?:\|[^\n]+\|\n?)+)/);
    if (!tableMatch) return null;
    
    const headerLine = sectionMatch[0].match(/\|([^\n]+)\|/);
    if (!headerLine) return null;
    
    const headers = headerLine[1].split('|').map(h => h.trim()).filter(Boolean);
    const dataRows = tableMatch[1].trim().split('\n');
    
    const data: Record<string, any>[] = [];
    const years = headers.filter(h => /\d{4}|forecast|run rate/i.test(h));
    
    dataRows.forEach(row => {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        const metric = cleanMarkdown(cells[0]);
        const values: Record<string, any> = { metric };
        years.forEach((year, idx) => {
          const rawValue = cells[idx + 1] || '';
          const numMatch = rawValue.match(/[\d,]+\.?\d*/);
          values[year] = numMatch ? parseFloat(numMatch[0].replace(/,/g, '')) : 0;
        });
        data.push(values);
      }
    });
    
    return { years, data };
  };

  const parseLendingAnalysis = (content: string) => {
    const sectionMatch = content.match(/## 3\. LENDING ANALYSIS[\s\S]*?(?=## 4\.|$)/i);
    if (!sectionMatch) return null;
    
    const dscrMatch = sectionMatch[0].match(/DSCR[^:]*:\s*([\d.]+)/i);
    const maxDebtMatch = sectionMatch[0].match(/Max(?:imum)?\s*(?:Annual)?\s*Debt[^:]*:\s*£?([\d,]+)/i);
    const viabilityMatch = sectionMatch[0].match(/viability[^:]*:([^\n]+)/i);
    
    return {
      dscr: dscrMatch ? parseFloat(dscrMatch[1]) : null,
      maxDebt: maxDebtMatch ? parseFloat(maxDebtMatch[1].replace(/,/g, '')) : null,
      viability: viabilityMatch ? viabilityMatch[1].trim() : null,
      rawSection: sectionMatch[0]
    };
  };

  const parseValuation = (content: string) => {
    const sectionMatch = content.match(/## 4\. VALUATION[\s\S]*?(?=## 5\.|$)/i);
    if (!sectionMatch) return null;
    
    const tableMatch = sectionMatch[0].match(/\|[^\n]+\|\n\|[-\s|:]+\|\n((?:\|[^\n]+\|\n?)+)/);
    if (!tableMatch) return null;
    
    const rows = tableMatch[1].trim().split('\n');
    const scenarios: { scenario: string; multiple: number; ev: number; adjustment: number; equity: number }[] = [];
    
    rows.forEach(row => {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 4) {
        const scenario = cells[0].replace(/\*\*/g, '');
        const multipleMatch = cells[1]?.match(/([\d.]+)/);
        const evMatch = cells[2]?.match(/[\d,]+/);
        const adjustMatch = cells[3]?.match(/[\d,]+/);
        const equityMatch = cells[4]?.match(/[\d,]+/);
        
        if (scenario && /conservative|base|aggressive/i.test(scenario)) {
          scenarios.push({
            scenario: scenario.charAt(0).toUpperCase() + scenario.slice(1).toLowerCase(),
            multiple: multipleMatch ? parseFloat(multipleMatch[1]) : 0,
            ev: evMatch ? parseFloat(evMatch[0].replace(/,/g, '')) : 0,
            adjustment: adjustMatch ? parseFloat(adjustMatch[0].replace(/,/g, '')) : 0,
            equity: equityMatch ? parseFloat(equityMatch[0].replace(/,/g, '')) : 0,
          });
        }
      }
    });
    
    return { scenarios, rawSection: sectionMatch[0] };
  };

  const parseBalanceSheet = (content: string) => {
    const sectionMatch = content.match(/## 5\. BALANCE SHEET[\s\S]*?(?=## 6\.|$)/i);
    if (!sectionMatch) return null;
    
    const assetItems: { name: string; value: number }[] = [];
    
    const assetPatterns = [
      { name: 'Fixed Assets', pattern: /fixed assets[^:]*:\s*£?([\d,]+)/i },
      { name: 'Cash', pattern: /cash[^:]*:\s*£?([\d,]+)/i },
      { name: 'Debtors', pattern: /debtors[^:]*:\s*£?([\d,]+)/i },
      { name: 'Stock', pattern: /stock[^:]*:\s*£?([\d,]+)/i },
      { name: 'Creditors', pattern: /creditors[^:]*:\s*£?([\d,]+)/i },
    ];
    
    assetPatterns.forEach(({ name, pattern }) => {
      const match = sectionMatch[0].match(pattern);
      if (match) {
        assetItems.push({ name, value: parseFloat(match[1].replace(/,/g, '')) });
      }
    });
    
    const tableMatch = sectionMatch[0].match(/\|[^\n]+\|\n\|[-\s|:]+\|\n((?:\|[^\n]+\|\n?)+)/);
    if (tableMatch && assetItems.length < 3) {
      const rows = tableMatch[1].trim().split('\n');
      rows.forEach(row => {
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          const name = cells[0].replace(/\*\*/g, '');
          const valueMatch = cells[1]?.match(/[\d,]+/);
          if (valueMatch && !assetItems.find(a => a.name.toLowerCase() === name.toLowerCase())) {
            assetItems.push({ name, value: parseFloat(valueMatch[0].replace(/,/g, '')) });
          }
        }
      });
    }
    
    return { assetItems, rawSection: sectionMatch[0] };
  };

  const parseRisks = (content: string) => {
    const sectionMatch = content.match(/## 6\. DUE DILIGENCE[\s\S]*$/i);
    if (!sectionMatch) return null;
    
    const criticalMatch = sectionMatch[0].match(/critical[^:]*:([\s\S]*?)(?=###\s*operational|operational\s*risks|$)/i);
    const operationalMatch = sectionMatch[0].match(/operational[^:]*:([\s\S]*?)$/i);
    
    return {
      critical: parseListItems(criticalMatch?.[1]),
      operational: parseListItems(operationalMatch?.[1]),
      rawSection: sectionMatch[0]
    };
  };

  const parseExecutiveSummary = (content: string) => {
    const sectionMatch = content.match(/## 1\. EXECUTIVE SUMMARY[\s\S]*?(?=## 2\.|$)/i);
    if (!sectionMatch) return null;
    
    const opportunityMatch = sectionMatch[0].match(/opportunity[^:]*:([\s\S]*?)(?=###\s*key highlights|key highlights|$)/i);
    const highlightsMatch = sectionMatch[0].match(/key highlights[^:]*:([\s\S]*?)$/i);
    
    return {
      opportunity: cleanMarkdown(opportunityMatch?.[1] || ''),
      highlights: parseListItems(highlightsMatch?.[1]),
      rawSection: sectionMatch[0]
    };
  };

  const financialData = parseFinancialPerformance(markdown);
  const lendingData = parseLendingAnalysis(markdown);
  const valuationData = parseValuation(markdown);
  const balanceSheetData = parseBalanceSheet(markdown);
  const risksData = parseRisks(markdown);
  const execSummary = parseExecutiveSummary(markdown);

  const getChartData = () => {
    if (!financialData) return [];
    
    return financialData.years.map(year => {
      const row: Record<string, any> = { year };
      financialData.data.forEach(d => {
        const key = d.metric.toLowerCase().includes('revenue') ? 'Revenue' :
                    d.metric.toLowerCase().includes('ebitda') ? 'EBITDA' :
                    d.metric.toLowerCase().includes('gross profit') ? 'Gross Profit' :
                    d.metric.toLowerCase().includes('operating') ? 'Operating Profit' : d.metric;
        row[key] = d[year] || 0;
      });
      return row;
    });
  };

  const chartData = getChartData();

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="financials" className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            Financials
          </TabsTrigger>
          <TabsTrigger value="lending" className="flex items-center gap-1">
            <CreditCard className="w-4 h-4" />
            Lending
          </TabsTrigger>
          <TabsTrigger value="valuation" className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            Valuation
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex items-center gap-1">
            <PieChartIcon className="w-4 h-4" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="risks" className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            Risks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {execSummary && (
            <Card className="border-2 border-purple-200 dark:border-purple-800">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {execSummary.opportunity && (
                  <div className="mb-6">
                    <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Opportunity</h4>
                    <p className="text-sm">{execSummary.opportunity}</p>
                  </div>
                )}
                {execSummary.highlights.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 text-sm text-muted-foreground">Key Highlights</h4>
                    <div className="grid gap-2">
                      {execSummary.highlights.map((highlight, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{highlight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Full Deal Sheet
              </CardTitle>
              <CardDescription>Complete analysis document</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials" className="space-y-6 mt-6">
          {chartData.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    Revenue & EBITDA Trend
                  </CardTitle>
                  <CardDescription>Financial performance over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="year" className="text-xs" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} className="text-xs" />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="EBITDA" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-green-500" />
                    Profit Comparison
                  </CardTitle>
                  <CardDescription>Gross Profit vs Operating Profit by year</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="year" className="text-xs" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} className="text-xs" />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Legend />
                        <Bar dataKey="Gross Profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Operating Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {financialData && (
            <Card>
              <CardHeader>
                <CardTitle>Financial Data Table</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-semibold">Metric</th>
                        {financialData.years.map(year => (
                          <th key={year} className="text-right py-2 px-3 font-semibold">{year}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {financialData.data.map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3 font-medium">{row.metric}</td>
                          {financialData.years.map(year => (
                            <td key={year} className="text-right py-2 px-3">
                              {typeof row[year] === 'number' ? formatCurrency(row[year]) : row[year]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="lending" className="space-y-6 mt-6">
          {lendingData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {lendingData.dscr && (
                  <Card className="border-2 border-blue-200 dark:border-blue-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" />
                        DSCR Gauge
                      </CardTitle>
                      <CardDescription>Debt Service Coverage Ratio</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart 
                            cx="50%" 
                            cy="50%" 
                            innerRadius="60%" 
                            outerRadius="80%" 
                            barSize={20} 
                            data={[{ name: 'DSCR', value: Math.min(lendingData.dscr * 40, 100), fill: lendingData.dscr >= 1.5 ? '#10b981' : lendingData.dscr >= 1.25 ? '#f59e0b' : '#ef4444' }]}
                            startAngle={180}
                            endAngle={0}
                          >
                            <RadialBar 
                              dataKey="value" 
                              background 
                              cornerRadius={10}
                            />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-center -mt-16">
                        <div className="text-4xl font-bold">{lendingData.dscr.toFixed(2)}x</div>
                        <div className="text-sm text-muted-foreground">Target: 1.5x</div>
                        <Badge className={`mt-2 ${lendingData.dscr >= 1.5 ? 'bg-green-100 text-green-800' : lendingData.dscr >= 1.25 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                          {lendingData.dscr >= 1.5 ? 'Strong' : lendingData.dscr >= 1.25 ? 'Acceptable' : 'Weak'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {lendingData.maxDebt && (
                  <Card className="border-2 border-green-200 dark:border-green-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-green-500" />
                        Maximum Debt Capacity
                      </CardTitle>
                      <CardDescription>Annual debt service capacity</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center h-64">
                      <div className="text-5xl font-bold text-green-600">{formatCurrency(lendingData.maxDebt)}</div>
                      <div className="text-sm text-muted-foreground mt-2">Maximum Annual Debt Service</div>
                      {lendingData.viability && (
                        <div className="mt-4 p-3 rounded-lg bg-muted/50 max-w-md text-center">
                          <span className="text-sm">{lendingData.viability}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Lending Analysis Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose dark:prose-invert max-w-none text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{lendingData.rawSection}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="valuation" className="space-y-6 mt-6">
          {valuationData && valuationData.scenarios.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-purple-500" />
                    Valuation Scenarios
                  </CardTitle>
                  <CardDescription>Conservative, Base, and Aggressive valuations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={valuationData.scenarios} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} className="text-xs" />
                        <YAxis dataKey="scenario" type="category" width={100} className="text-xs" />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Legend />
                        <Bar dataKey="ev" name="Enterprise Value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="equity" name="Equity Value" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {valuationData.scenarios.map((scenario, idx) => (
                  <Card key={idx} className={`border-2 ${
                    scenario.scenario.toLowerCase() === 'conservative' ? 'border-blue-200 dark:border-blue-800' :
                    scenario.scenario.toLowerCase() === 'base' ? 'border-green-200 dark:border-green-800' :
                    'border-purple-200 dark:border-purple-800'
                  }`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{scenario.scenario}</CardTitle>
                      <CardDescription>{scenario.multiple}x Multiple</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Enterprise Value</span>
                          <span className="font-semibold">{formatCurrency(scenario.ev)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Net Adjustment</span>
                          <span className="font-semibold">{formatCurrency(scenario.adjustment)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="font-medium">Equity Value</span>
                          <span className="font-bold text-green-600">{formatCurrency(scenario.equity)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {valuationData && (
            <Card>
              <CardHeader>
                <CardTitle>Valuation Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{valuationData.rawSection}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assets" className="space-y-6 mt-6">
          {balanceSheetData && balanceSheetData.assetItems.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChartIcon className="w-5 h-5 text-blue-500" />
                      Asset Composition
                    </CardTitle>
                    <CardDescription>Breakdown of company assets</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={balanceSheetData.assetItems.filter(a => a.value > 0)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {balanceSheetData.assetItems.filter(a => a.value > 0).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Scale className="w-5 h-5 text-green-500" />
                      Asset Values
                    </CardTitle>
                    <CardDescription>Individual asset breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={balanceSheetData.assetItems} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} className="text-xs" />
                          <YAxis dataKey="name" type="category" width={80} className="text-xs" />
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                          />
                          <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                            {balanceSheetData.assetItems.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {balanceSheetData && (
            <Card>
              <CardHeader>
                <CardTitle>Balance Sheet Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{balanceSheetData.rawSection}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="risks" className="space-y-6 mt-6">
          {risksData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {risksData.critical.length > 0 && (
                  <Card className="border-2 border-red-200 dark:border-red-800">
                    <CardHeader className="bg-red-50 dark:bg-red-950/20">
                      <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertTriangle className="w-5 h-5" />
                        Critical Risks
                      </CardTitle>
                      <CardDescription>High priority issues requiring immediate attention</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        {risksData.critical.map((risk, idx) => (
                          <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{risk}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {risksData.operational.length > 0 && (
                  <Card className="border-2 border-amber-200 dark:border-amber-800">
                    <CardHeader className="bg-amber-50 dark:bg-amber-950/20">
                      <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-5 h-5" />
                        Operational Risks
                      </CardTitle>
                      <CardDescription>Issues to address during due diligence</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        {risksData.operational.map((risk, idx) => (
                          <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{risk}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Due Diligence Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose dark:prose-invert max-w-none text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{risksData.rawSection}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {usageMetadata && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Analysis Metadata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Prompt Tokens</div>
                <div className="font-semibold">{usageMetadata.promptTokenCount?.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Response Tokens</div>
                <div className="font-semibold">{usageMetadata.candidatesTokenCount?.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Thinking Tokens</div>
                <div className="font-semibold">{usageMetadata.thoughtsTokenCount?.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total Tokens</div>
                <div className="font-semibold">{usageMetadata.totalTokenCount?.toLocaleString()}</div>
              </div>
              {processingTime && (
                <div>
                  <div className="text-muted-foreground">Processing Time</div>
                  <div className="font-semibold">{(processingTime / 1000).toFixed(1)}s</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
