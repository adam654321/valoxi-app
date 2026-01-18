import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Building2, 
  FileText, AlertTriangle, CheckCircle, Target, BarChart3,
  PieChart as PieChartIcon, Wallet, Scale, Loader2, Play
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Stage1AnalysisDisplayProps {
  targetCompanyId: number;
  markdown: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    promptTokensDetails?: Array<{ modality: string; tokenCount: number }>;
    thoughtsTokenCount?: number;
  };
  processingTime?: number;
  detailedAnalysisData?: any;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function Stage1AnalysisDisplay({ targetCompanyId, markdown, usageMetadata, processingTime, detailedAnalysisData }: Stage1AnalysisDisplayProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const detailedAnalysisMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/target-companies/${targetCompanyId}/detailed-analysis`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/target-companies/${targetCompanyId}/stage1-analysis`] });
      toast({
        title: "Success",
        description: "Detailed analysis has been initiated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate detailed analysis.",
        variant: "destructive",
      });
    },
  });
  const parseProfitabilityTable = (content: string) => {
    const tableMatch = content.match(/\| Metric \| 2020.*?\n(?:\|.*\n)+/);
    if (!tableMatch) return null;
    
    const rows = tableMatch[0].split('\n').filter(row => row.trim() && !row.includes('---'));
    const headers = rows[0].split('|').map(h => h.trim()).filter(Boolean);
    const data: Record<string, any>[] = [];
    
    const years = headers.slice(1, -1);
    
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length > 0) {
        const metric = cells[0].replace(/\*\*/g, '');
        const rowData: Record<string, any> = { metric };
        years.forEach((year, idx) => {
          const value = cells[idx + 1] || '';
          rowData[year] = value;
        });
        rowData['trend'] = cells[cells.length - 1] || '';
        data.push(rowData);
      }
    }
    
    return { years, data };
  };

  const parseBalanceSheetTable = (content: string) => {
    const sectionMatch = content.match(/### 2\..*?Balance Sheet.*?\n([\s\S]*?)(?=###|$)/);
    if (!sectionMatch) return null;
    
    const tableMatch = sectionMatch[1].match(/\| Metric \| 2020.*?\n(?:\|.*\n)+/);
    if (!tableMatch) return null;
    
    const rows = tableMatch[0].split('\n').filter(row => row.trim() && !row.includes('---'));
    const headers = rows[0].split('|').map(h => h.trim()).filter(Boolean);
    const data: Record<string, any>[] = [];
    
    const years = headers.slice(1);
    
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length > 0) {
        const metric = cells[0].replace(/\*\*/g, '');
        const rowData: Record<string, any> = { metric };
        years.forEach((year, idx) => {
          rowData[year] = cells[idx + 1] || '';
        });
        data.push(rowData);
      }
    }
    
    return { years, data };
  };

  const parseAssetRegister = (content: string) => {
    const sectionMatch = content.match(/### 3\..*?Asset Register.*?\n([\s\S]*?)(?=###|$)/);
    if (!sectionMatch) return null;
    
    const metrics: Record<string, string> = {};
    const tableMatch = sectionMatch[1].match(/\| Metric \| Value \|[\s\S]*?(?=\n\n|\*\*Key)/);
    if (tableMatch) {
      const rows = tableMatch[0].split('\n').filter(row => row.trim() && !row.includes('---') && !row.includes('Metric'));
      rows.forEach(row => {
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          const key = cells[0].replace(/\*\*/g, '');
          metrics[key] = cells[1];
        }
      });
    }
    
    const insights = sectionMatch[1].match(/\*\*Key Insights:\*\*([\s\S]*?)(?=###|$)/);
    
    return { metrics, insights: insights ? insights[1].trim() : '' };
  };

  const parseSalesLedger = (content: string) => {
    const sectionMatch = content.match(/### 4\..*?Sales Ledger.*?\n([\s\S]*?)(?=###|$)/);
    if (!sectionMatch) return null;
    
    const metrics: Record<string, string> = {};
    const tableMatch = sectionMatch[1].match(/\| Metric \| Value \|[\s\S]*?(?=\n\n|\*\*Observation)/);
    if (tableMatch) {
      const rows = tableMatch[0].split('\n').filter(row => row.trim() && !row.includes('---') && !row.includes('Metric'));
      rows.forEach(row => {
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          const key = cells[0].replace(/\*\*/g, '');
          metrics[key] = cells[1];
        }
      });
    }
    
    const observations = sectionMatch[1].match(/\*\*Observations:\*\*([\s\S]*?)(?=###|$)/);
    
    return { metrics, observations: observations ? observations[1].trim() : '' };
  };

  const parseStaffMatrix = (content: string) => {
    const sectionMatch = content.match(/### 5\..*?Staff Matrix.*?\n([\s\S]*?)(?=###|$)/);
    if (!sectionMatch) return null;
    
    const metrics: Record<string, string> = {};
    const tableMatch = sectionMatch[1].match(/\| Metric \| Value \|[\s\S]*?(?=\n\n|\*\*Observation)/);
    if (tableMatch) {
      const rows = tableMatch[0].split('\n').filter(row => row.trim() && !row.includes('---') && !row.includes('Metric'));
      rows.forEach(row => {
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          const key = cells[0].replace(/\*\*/g, '');
          metrics[key] = cells[1];
        }
      });
    }
    
    const observations = sectionMatch[1].match(/\*\*Observations:\*\*([\s\S]*?)(?=###|$)/);
    
    return { metrics, observations: observations ? observations[1].trim() : '' };
  };

  const parseInvestmentSummary = (content: string) => {
    const sectionMatch = content.match(/### 6\..*?Investment Summary.*?\n([\s\S]*?)$/);
    if (!sectionMatch) return null;
    
    const swot = {
      strengths: [] as string[],
      weaknesses: [] as string[],
      opportunities: [] as string[],
      risks: [] as string[]
    };
    
    const extractItems = (text: string): string[] => {
      const matches = text.match(/\*\s+([^\n]+)/g) || [];
      return matches
        .map(s => s.replace(/^\*\s+/, '').trim())
        .filter(s => s.length > 0);
    };

    const strengthsMatch = sectionMatch[1].match(/\*\*Strengths:\*\*([\s\S]*?)(?=\*\*Weaknesses|\*\*Opportunities|\*\*Risks|$)/);
    if (strengthsMatch) {
      swot.strengths = extractItems(strengthsMatch[1]);
    }
    
    const weaknessesMatch = sectionMatch[1].match(/\*\*Weaknesses:\*\*([\s\S]*?)(?=\*\*Opportunities|\*\*Risks|\*\*Final|$)/);
    if (weaknessesMatch) {
      swot.weaknesses = extractItems(weaknessesMatch[1]);
    }
    
    const opportunitiesMatch = sectionMatch[1].match(/\*\*Opportunities:\*\*([\s\S]*?)(?=\*\*Risks|\*\*Final|$)/);
    if (opportunitiesMatch) {
      swot.opportunities = extractItems(opportunitiesMatch[1]);
    }
    
    const risksMatch = sectionMatch[1].match(/\*\*Risks:\*\*([\s\S]*?)(?=\*\*Final|$)/);
    if (risksMatch) {
      swot.risks = extractItems(risksMatch[1]);
    }
    
    const verdictMatch = sectionMatch[1].match(/\*\*Final Verdict:\*\*[\s\S]*?\*\*"([^"]+)"\*\*/);
    const justificationMatch = sectionMatch[1].match(/\*\*Justification:\*\*([\s\S]*?)$/);
    
    return {
      swot,
      verdict: verdictMatch ? verdictMatch[1] : '',
      justification: justificationMatch ? justificationMatch[1].trim() : ''
    };
  };

  const parseNumber = (value: string): number => {
    const cleaned = value.replace(/[£$,]/g, '').replace(/,/g, '');
    return parseFloat(cleaned) || 0;
  };

  const profitability = parseProfitabilityTable(markdown);
  const balanceSheet = parseBalanceSheetTable(markdown);
  const assetRegister = parseAssetRegister(markdown);
  const salesLedger = parseSalesLedger(markdown);
  const staffMatrix = parseStaffMatrix(markdown);
  const investmentSummary = parseInvestmentSummary(markdown);

  const getRevenueChartData = () => {
    if (!profitability) return [];
    const revenueRow = profitability.data.find(d => d.metric === 'Revenue');
    if (!revenueRow) return [];
    
    return profitability.years.map(year => ({
      year,
      revenue: parseNumber(revenueRow[year]) / 1000000
    }));
  };

  const getProfitChartData = () => {
    if (!profitability) return [];
    const netProfitRow = profitability.data.find(d => d.metric === 'Net Profit');
    const opProfitRow = profitability.data.find(d => d.metric === 'Operating Profit');
    if (!netProfitRow) return [];
    
    return profitability.years.map(year => ({
      year,
      netProfit: parseNumber(netProfitRow[year]) / 1000000,
      operatingProfit: opProfitRow ? parseNumber(opProfitRow[year]) / 1000000 : 0
    }));
  };

  const getMarginChartData = () => {
    if (!profitability) return [];
    const grossMargin = profitability.data.find(d => d.metric === 'Gross Margin %');
    const opMargin = profitability.data.find(d => d.metric === 'Operating Margin %');
    const netMargin = profitability.data.find(d => d.metric === 'Net Margin %');
    
    return profitability.years.map(year => ({
      year,
      gross: parseFloat(grossMargin?.[year]?.replace('%', '') || '0'),
      operating: parseFloat(opMargin?.[year]?.replace('%', '') || '0'),
      net: parseFloat(netMargin?.[year]?.replace('%', '') || '0')
    }));
  };

  const revenueData = getRevenueChartData();
  const profitData = getProfitChartData();
  const marginData = getMarginChartData();

  return (
    <div className="space-y-6">
      <Tabs defaultValue="profitability" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profitability" className="text-xs">Profitability</TabsTrigger>
          <TabsTrigger value="balance-sheet" className="text-xs">Balance Sheet</TabsTrigger>
          <TabsTrigger value="assets" className="text-xs">Assets</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs">Sales Ledger</TabsTrigger>
          <TabsTrigger value="staff" className="text-xs">Staff</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="profitability" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Profitability & Earnings Quality
              </CardTitle>
              <CardDescription>5-year financial performance analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {revenueData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Revenue Trend (£M)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={revenueData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value: number) => [`£${value.toFixed(1)}M`, 'Revenue']} />
                          <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Profit Trend (£M)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={profitData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value: number) => [`£${value.toFixed(2)}M`]} />
                          <Legend />
                          <Bar dataKey="operatingProfit" name="Operating" fill="#10b981" />
                          <Bar dataKey="netProfit" name="Net" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {marginData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Margin Analysis (%)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={marginData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} domain={[0, 50]} />
                        <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`]} />
                        <Legend />
                        <Line type="monotone" dataKey="gross" name="Gross Margin" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="operating" name="Operating Margin" stroke="#f59e0b" strokeWidth={2} />
                        <Line type="monotone" dataKey="net" name="Net Margin" stroke="#3b82f6" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {profitability && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-semibold">Metric</th>
                        {profitability.years.map(year => (
                          <th key={year} className="text-right p-3 font-semibold">{year}</th>
                        ))}
                        <th className="text-center p-3 font-semibold">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitability.data.map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-medium">{row.metric}</td>
                          {profitability.years.map(year => (
                            <td key={year} className="text-right p-3">{row[year]}</td>
                          ))}
                          <td className="text-center p-3">
                            <Badge variant={row.trend?.includes('Declining') ? 'destructive' : row.trend?.includes('Stable') ? 'secondary' : 'default'}>
                              {row.trend}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance-sheet" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-green-500" />
                Balance Sheet Strength & Liquidity
              </CardTitle>
              <CardDescription>Asset and liability analysis over time</CardDescription>
            </CardHeader>
            <CardContent>
              {balanceSheet && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-semibold">Metric</th>
                        {balanceSheet.years.map(year => (
                          <th key={year} className="text-right p-3 font-semibold">{year}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {balanceSheet.data.map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-medium">{row.metric}</td>
                          {balanceSheet.years.map(year => (
                            <td key={year} className="text-right p-3">{row[year]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-500" />
                Asset Register Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assetRegister && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(assetRegister.metrics).map(([key, value]) => (
                      <Card key={key} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground">{key}</div>
                          <div className="text-2xl font-bold mt-1">{value}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {assetRegister.insights && (
                    <div className="prose dark:prose-invert max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{assetRegister.insights}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-orange-500" />
                Sales Ledger & Customer Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesLedger && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Object.entries(salesLedger.metrics).map(([key, value]) => (
                      <Card key={key} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground">{key}</div>
                          <div className="text-xl font-bold mt-1">{value}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {salesLedger.observations && (
                    <div className="prose dark:prose-invert max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{salesLedger.observations}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-500" />
                Staff Matrix Evaluation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {staffMatrix && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(staffMatrix.metrics).map(([key, value]) => (
                      <Card key={key} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground">{key}</div>
                          <div className="text-2xl font-bold mt-1">{value}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {staffMatrix.observations && (
                    <div className="prose dark:prose-invert max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{staffMatrix.observations}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-6 mt-6">
          {investmentSummary && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-2 border-green-200 dark:border-green-800">
                  <CardHeader className="bg-green-50 dark:bg-green-950/20">
                    <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle className="w-5 h-5" />
                      Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-2">
                      {investmentSummary.swot.strengths.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="prose prose-sm dark:prose-invert [&>p]:m-0 [&>p]:inline"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item}</ReactMarkdown></span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-red-200 dark:border-red-800">
                  <CardHeader className="bg-red-50 dark:bg-red-950/20">
                    <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                      <AlertTriangle className="w-5 h-5" />
                      Weaknesses
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-2">
                      {investmentSummary.swot.weaknesses.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <span className="prose prose-sm dark:prose-invert [&>p]:m-0 [&>p]:inline"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item}</ReactMarkdown></span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-blue-200 dark:border-blue-800">
                  <CardHeader className="bg-blue-50 dark:bg-blue-950/20">
                    <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <TrendingUp className="w-5 h-5" />
                      Opportunities
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-2">
                      {investmentSummary.swot.opportunities.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Target className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span className="prose prose-sm dark:prose-invert [&>p]:m-0 [&>p]:inline"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item}</ReactMarkdown></span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-orange-200 dark:border-orange-800">
                  <CardHeader className="bg-orange-50 dark:bg-orange-950/20">
                    <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                      <AlertTriangle className="w-5 h-5" />
                      Risks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-2">
                      {investmentSummary.swot.risks.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          <span className="prose prose-sm dark:prose-invert [&>p]:m-0 [&>p]:inline"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item}</ReactMarkdown></span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-2 border-purple-200 dark:border-purple-800">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                  <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                    <BarChart3 className="w-5 h-5" />
                    Final Verdict
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-4 mb-4">
                    <Badge variant="outline" className="text-lg px-4 py-2 border-2 border-purple-500 text-purple-700 dark:text-purple-400">
                      {investmentSummary.verdict}
                    </Badge>
                  </div>
                  <div className="prose dark:prose-invert max-w-none text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{investmentSummary.justification}</ReactMarkdown>
                  </div>

                  <Separator className="my-6" />
                  
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="text-center space-y-2">
                      <h4 className="font-semibold text-lg">Detailed Analysis</h4>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Run a deeper Gemini-powered analysis focusing on asset management, 
                        capital efficiency, and operational deep-dives.
                      </p>
                    </div>
                    
                    <Button 
                      size="lg" 
                      className="gap-2"
                      onClick={() => detailedAnalysisMutation.mutate()}
                      disabled={detailedAnalysisMutation.isPending}
                    >
                      {detailedAnalysisMutation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                      Carry out detailed analysis
                    </Button>
                    
                    {detailedAnalysisData && (
                      <Card className="w-full mt-6 border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/10">
                        <CardHeader>
                          <CardTitle className="text-md flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-500" />
                            Detailed Analysis Results
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="prose dark:prose-invert max-w-none text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {typeof detailedAnalysisData === 'string' ? detailedAnalysisData : JSON.stringify(detailedAnalysisData, null, 2)}
                            </ReactMarkdown>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {usageMetadata && (
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" />
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
                {usageMetadata.promptTokensDetails && usageMetadata.promptTokensDetails.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm text-muted-foreground mb-2">Token Breakdown by Modality</div>
                    <div className="flex gap-4">
                      {usageMetadata.promptTokensDetails.map((detail, idx) => (
                        <Badge key={idx} variant="outline">
                          {detail.modality}: {detail.tokenCount.toLocaleString()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
